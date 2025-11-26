// typing-simulator.js
(function() {
  let originalText = '';
  let typedText = '';
  let textContainer = null;
  let hiddenInput = null;
  let completionScreen = null;
  let restartButton = null;
  let startOverButton = null;

  // Character states: 'pending', 'correct', 'incorrect'
  const charStates = [];

  // Statistics tracking
  let startTime = null;
  let totalErrors = 0;
  let totalInputs = 0;

  function setStatus(msg) {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = msg;
    }
  }

  async function loadText() {
    try {
      setStatus('Loading...');
      const response = await fetch('./text-to-input.txt');
      if (!response.ok) {
        throw new Error('Failed to load text file');
      }
      originalText = await response.text();
      // Trim trailing whitespace/newlines but keep the original for display
      originalText = originalText.trimEnd();

      // Initialize character states
      charStates.length = 0;
      for (let i = 0; i < originalText.length; i++) {
        charStates.push('pending');
      }

      renderText();
      setStatus('Ready');
    } catch (error) {
      console.error('Error loading text:', error);
      setStatus('Failed to load data');
      if (textContainer) {
        textContainer.innerHTML = '<p>Error: Could not load text file.</p>';
      }
    }
  }

  function renderText() {
    if (!textContainer) return;

    // Check if completed - show completion screen when all characters are typed
    // (regardless of whether they're correct or not)
    const typedTrimmed = typedText.trimEnd();
    const originalTrimmed = originalText.trimEnd();

    // Check if all characters are typed (even if there are mistakes)
    if (typedTrimmed.length === originalTrimmed.length) {
      console.log('Completion detected! Showing completion screen.');
      console.log('Typed length:', typedTrimmed.length, 'Original length:', originalTrimmed.length);
      showCompletionScreen();
      return;
    }

    // Hide completion screen if visible and show typing container
    if (completionScreen) {
      completionScreen.style.display = 'none';
    }
    const typingTextContainer = document.querySelector('.typing-text-container');
    if (typingTextContainer) {
      typingTextContainer.style.display = 'block';
    }

    let html = '';
    const currentPosition = typedText.length;

    for (let i = 0; i < originalText.length; i++) {
      const char = originalText[i];
      const state = charStates[i];
      let className = 'char-';

      if (i < typedText.length) {
        // Character has been typed
        if (state === 'incorrect') {
          className += 'incorrect';
        } else {
          className += 'correct';
        }
      } else {
        // Character not yet typed
        className += 'pending';
      }

      // Handle special characters that need escaping
      let displayChar = char;
      if (char === ' ') {
        displayChar = '\u00A0'; // Non-breaking space
      } else if (char === '\n') {
        displayChar = '<br>';
      } else {
        displayChar = escapeHtml(char);
      }

      // Add cursor class to the character at the typing position
      if (i === currentPosition) {
        className += ' cursor-position';
      }

      html += `<span class="${className}">${displayChar}</span>`;
    }

    // If all characters are typed, add a cursor position marker at the end
    if (currentPosition === originalText.length) {
      html += '<span class="char-pending cursor-position">\u00A0</span>';
    }

    textContainer.innerHTML = html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function handleInput(e) {
    let input = e.target.value;

    // Start timer on first keypress
    if (startTime === null && input.length > 0) {
      startTime = Date.now();
    }

    // Prevent typing beyond the original text length
    if (input.length > originalText.length) {
      input = input.slice(0, originalText.length);
      e.target.value = input;
    }

    const inputLength = input.length;
    const typedLength = typedText.length;

    // Handle typing forward
    if (inputLength > typedLength) {
      const newChars = input.slice(typedLength);
      for (let i = 0; i < newChars.length; i++) {
        const charIndex = typedLength + i;
        if (charIndex >= originalText.length) {
          break;
        }

        const expectedChar = originalText[charIndex];
        const typedChar = newChars[i];

        totalInputs++; // Track total inputs

        if (typedChar === expectedChar) {
          charStates[charIndex] = 'correct';
        } else {
          charStates[charIndex] = 'incorrect';
          totalErrors++; // Track total errors (even if later fixed)
        }
      }
      typedText = input;
    }
    // Handle backspace/delete
    else if (inputLength < typedLength) {
      typedText = input;
      // Reset states for characters that are no longer typed
      for (let i = inputLength; i < originalText.length; i++) {
        if (i < charStates.length) {
          charStates[i] = 'pending';
        }
      }
    }

    renderText();
  }

  function handleKeyDown(e) {
    // Prevent default behavior for backspace when at start
    if (e.key === 'Backspace' && hiddenInput.value.length === 0) {
      e.preventDefault();
    }

    // Allow all other keys to work normally
    // The input handler will process the changes
  }

  function restart() {
    typedText = '';
    for (let i = 0; i < charStates.length; i++) {
      charStates[i] = 'pending';
    }
    if (hiddenInput) {
      hiddenInput.value = '';
    }

    // Reset statistics
    startTime = null;
    totalErrors = 0;
    totalInputs = 0;

    // Show typing container and hide completion screen
    const typingTextContainer = document.querySelector('.typing-text-container');
    if (typingTextContainer) {
      typingTextContainer.style.display = 'block';
    }
    if (completionScreen) {
      completionScreen.style.display = 'none';
    }

    // Show the restart button again
    if (restartButton && restartButton.parentElement) {
      restartButton.parentElement.style.display = 'block';
    }

    renderText();
    setStatus('Ready');

    // Focus the input after a short delay
    setTimeout(() => {
      if (hiddenInput) {
        hiddenInput.focus();
      }
    }, 50);
  }

  function calculateStatistics() {
    console.log('Calculating statistics...');
    console.log('startTime:', startTime, 'totalInputs:', totalInputs, 'totalErrors:', totalErrors);

    if (startTime === null) {
      console.log('No typing started, returning null');
      return null; // No typing started
    }

    const endTime = Date.now();
    const totalTimeSeconds = (endTime - startTime) / 1000;
    const totalTimeMinutes = totalTimeSeconds / 60;

    // Count errors left (unfixed incorrect characters)
    let errorsLeft = 0;
    for (let i = 0; i < charStates.length; i++) {
      if (charStates[i] === 'incorrect') {
        errorsLeft++;
      }
    }

    // Calculate accuracy: (correct inputs / total inputs) * 100
    const correctInputs = totalInputs - totalErrors;
    const accuracy = totalInputs > 0 ? (correctInputs / totalInputs) * 100 : 0;

    // Calculate words per minute
    // Count words by splitting on whitespace
    const wordsTyped = originalText.trim().split(/\s+/).filter(word => word.length > 0).length;
    const wpm = totalTimeMinutes > 0 ? wordsTyped / totalTimeMinutes : 0;

    const stats = {
      totalErrors: totalErrors,
      errorsLeft: errorsLeft,
      totalTime: totalTimeSeconds,
      accuracy: accuracy,
      speed: wpm
    };

    console.log('Calculated statistics:', stats);
    return stats;
  }

  async function saveStatistics(stats) {
    console.log('saveStatistics called with:', stats);
    try {
      // Format statistics text
      const statsText = `Typing Statistics
==================

Total Errors Made: ${stats.totalErrors}
Errors Left (Unfixed): ${stats.errorsLeft}
Total Time: ${stats.totalTime.toFixed(2)} seconds
Accuracy: ${stats.accuracy.toFixed(2)}%
Speed: ${stats.speed.toFixed(2)} words per minute

Generated: ${new Date().toLocaleString()}
`;

      console.log('Sending stats to server:', statsText);
      const response = await fetch('/save-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: statsText
      });

      console.log('Server response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Statistics saved to client/stats.txt', result);
      } else {
        const errorText = await response.text();
        console.error('Failed to save statistics:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error saving statistics:', error);
    }
  }

  function showCompletionScreen() {
    console.log('showCompletionScreen called');

    if (!completionScreen) {
      console.error('Completion screen element not found!');
      return;
    }

    const typingTextContainer = document.querySelector('.typing-text-container');
    if (typingTextContainer) {
      typingTextContainer.style.display = 'none';
    }

    // Hide the restart button when completion screen is shown
    if (restartButton && restartButton.parentElement) {
      restartButton.parentElement.style.display = 'none';
    }

    // Calculate and save statistics
    console.log('About to calculate statistics...');
    const stats = calculateStatistics();
    console.log('Statistics result:', stats);

    if (stats) {
      console.log('Calling saveStatistics...');
      saveStatistics(stats);
    } else {
      console.log('No statistics to save (stats is null)');
    }

    completionScreen.style.display = 'flex';
    console.log('Completion screen displayed:', completionScreen.style.display);

    if (hiddenInput) {
      hiddenInput.blur();
    }
  }

  function initialize() {
    textContainer = document.getElementById('typing-text');
    hiddenInput = document.getElementById('hidden-input');
    completionScreen = document.getElementById('completion-screen');
    restartButton = document.getElementById('btn-restart');
    startOverButton = document.getElementById('btn-start-over');

    if (!textContainer || !hiddenInput) {
      console.error('Required elements not found');
      return;
    }

    // Set up event listeners
    hiddenInput.addEventListener('input', handleInput);
    hiddenInput.addEventListener('keydown', handleKeyDown);

    if (restartButton) {
      restartButton.addEventListener('click', restart);
    }

    if (startOverButton) {
      startOverButton.addEventListener('click', restart);
    }

    // Focus the input when clicking on the text container
    const typingTextContainer = document.querySelector('.typing-text-container');
    if (typingTextContainer) {
      typingTextContainer.addEventListener('click', () => {
        if (hiddenInput && completionScreen && completionScreen.style.display !== 'flex') {
          hiddenInput.focus();
        }
      });
    }

    // Load the text
    loadText();

    // Focus the input after a short delay
    setTimeout(() => {
      if (hiddenInput && completionScreen && completionScreen.style.display !== 'flex') {
        hiddenInput.focus();
      }
    }, 100);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
