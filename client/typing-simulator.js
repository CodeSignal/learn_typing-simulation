// typing-simulator.js
(function() {
  let originalText = '';
  let typedText = '';
  let textContainer = null;
  let hiddenInput = null;
  let completionScreen = null;
  let statsDashboard = null;
  let restartButton = null;
  let startOverButton = null;
  let statsStartOverButton = null;
  let keyboardContainer = null;
  let realtimeStatsContainer = null;
  let config = { keyboard: true, availableKeys: [], showStats: false, realTimeStats: [] };

  // Normalized set of available keys (for fast lookup)
  let availableKeysSet = new Set();

  // Character states: 'pending', 'correct', 'incorrect'
  const charStates = [];

  // Statistics tracking
  let startTime = null;
  let totalErrors = 0;
  let totalInputs = 0;

  // Keyboard state
  let keyboardEnabled = false;
  let activeKeyElement = null;
  let activeKeyTimeout = null;

  // Real-time stats update interval
  let realtimeStatsInterval = null;

  function setStatus(msg) {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = msg;
    }
  }

  // Load configuration
  async function loadConfig() {
    try {
      const response = await fetch('./config.json');
      if (!response.ok) {
        console.warn('Config file not found, using defaults');
        return;
      }
      config = await response.json();

      // Normalize available keys to lowercase for fast lookup
      // Empty array means all keys are available
      if (config.availableKeys && Array.isArray(config.availableKeys) && config.availableKeys.length > 0) {
        availableKeysSet = new Set(config.availableKeys.map(key => key.toLowerCase()));
      } else {
        availableKeysSet = new Set(); // Empty set means all keys available
      }
    } catch (error) {
      console.warn('Error loading config:', error);
    }
  }

  // Keyboard layout definition
  const keyboardLayout = [
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'backspace'],
    ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
    ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'enter'],
    ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'shift'],
    ['space']
  ];

  // Map special keys to display names
  const keyDisplayNames = {
    'backspace': '⌫',
    'tab': 'Tab',
    'caps': 'Caps',
    'enter': 'Enter',
    'shift': 'Shift',
    'space': 'Space'
  };

  // Check if a key is available for typing
  // Accepts both character values (from input) and KeyboardEvent.key values
  function isKeyAvailable(key) {
    // Space, comma, dot, backspace, and enter are ALWAYS available
    const keyLower = key.toLowerCase();
    if (key === ' ' || key === '\u00A0' || key === ',' || key === '.' ||
        key === 'Backspace' || key === '\b' || key === 'Enter' || key === 'Return' ||
        key === '\n' || key === '\r' ||
        keyLower === 'space' || keyLower === 'comma' || keyLower === 'dot' ||
        keyLower === 'backspace' || keyLower === 'enter') {
      return true;
    }

    // If no available keys are configured, all keys are available
    if (availableKeysSet.size === 0) {
      return true;
    }

    // Handle KeyboardEvent.key values (e.g., "Tab")
    if (key === 'Tab' || keyLower === 'tab') {
      return availableKeysSet.has('tab');
    }

    // Handle character values (from input events)
    if (key === '\t') {
      return availableKeysSet.has('tab');
    }

    // For regular keys, normalize to lowercase and check
    // Handle both single characters and KeyboardEvent.key values
    const normalizedKey = key.length === 1 ? key.toLowerCase() : keyLower;
    return availableKeysSet.has(normalizedKey);
  }

  // Get key element by character
  function getKeyElement(char) {
    if (!keyboardContainer) return null;

    // Normalize character
    const normalizedChar = char.toLowerCase();

    // Handle special keys
    if (char === ' ') {
      return keyboardContainer.querySelector('[data-key="space"]');
    }
    if (char === '\n' || char === '\r') {
      return keyboardContainer.querySelector('[data-key="enter"]');
    }
    if (char === '\t') {
      return keyboardContainer.querySelector('[data-key="tab"]');
    }

    // Find regular key
    return keyboardContainer.querySelector(`[data-key="${normalizedChar}"]`);
  }

  // Highlight a key on the keyboard
  function highlightKey(char, isError = false) {
    // Don't highlight unavailable keys
    if (!isKeyAvailable(char)) {
      return;
    }

    // Clear previous highlight
    if (activeKeyElement) {
      activeKeyElement.classList.remove('active', 'active-error');
    }

    // Clear timeout if exists
    if (activeKeyTimeout) {
      clearTimeout(activeKeyTimeout);
    }

    const keyElement = getKeyElement(char);
    if (keyElement) {
      activeKeyElement = keyElement;
      if (isError) {
        keyElement.classList.add('active-error');
      } else {
        keyElement.classList.add('active');
      }

      // Remove highlight after animation
      activeKeyTimeout = setTimeout(() => {
        if (keyElement) {
          keyElement.classList.remove('active', 'active-error');
        }
        activeKeyElement = null;
      }, 200);
    }
  }

  // Render the keyboard
  function renderKeyboard() {
    if (!keyboardContainer) return;

    const keyboard = document.createElement('div');
    keyboard.className = 'keyboard';

    keyboardLayout.forEach(row => {
      const rowElement = document.createElement('div');
      rowElement.className = 'keyboard-row';

      row.forEach(key => {
        const keyElement = document.createElement('div');
        const normalizedKey = key.toLowerCase();
        keyElement.className = 'keyboard-key';
        keyElement.setAttribute('data-key', normalizedKey);

        // Check if this key is available (use isKeyAvailable to ensure space, comma, dot are always available)
        const isAvailable = isKeyAvailable(key);
        if (!isAvailable) {
          keyElement.classList.add('unavailable');
        }

        // Add special class for certain keys
        if (key === 'space' || key === 'enter' || key === 'shift' ||
            key === 'backspace' || key === 'tab' || key === 'caps') {
          keyElement.classList.add(key);
        }

        // Set display text
        if (keyDisplayNames[key]) {
          keyElement.textContent = keyDisplayNames[key];
        } else {
          keyElement.textContent = key.toUpperCase();
        }

        rowElement.appendChild(keyElement);
      });

      keyboard.appendChild(rowElement);
    });

    keyboardContainer.innerHTML = '';
    keyboardContainer.appendChild(keyboard);
  }

  // Initialize keyboard
  function initializeKeyboard() {
    keyboardContainer = document.getElementById('keyboard-container');
    if (!keyboardContainer) return;

    keyboardEnabled = config.keyboard === true;

    if (keyboardEnabled) {
      renderKeyboard();
      keyboardContainer.classList.add('visible');
    } else {
      keyboardContainer.classList.remove('visible');
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

    // Filter out unavailable keys if availableKeys is configured
    if (availableKeysSet.size > 0) {
      let filteredInput = '';
      for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (isKeyAvailable(char)) {
          filteredInput += char;
        }
      }
      input = filteredInput;
      e.target.value = input;
    }

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

        const isError = typedChar !== expectedChar;
        if (isError) {
          charStates[charIndex] = 'incorrect';
          totalErrors++; // Track total errors (even if later fixed)
        } else {
          charStates[charIndex] = 'correct';
        }

        // Highlight keyboard key
        if (keyboardEnabled) {
          highlightKey(typedChar, isError);
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

      // Highlight backspace key (only if available)
      if (keyboardEnabled && isKeyAvailable('backspace')) {
        highlightKey('backspace', false);
      }
    }

    renderText();
    updateRealtimeStats();
  }

  function handleKeyDown(e) {
    // Handle Enter key - check availability but let textarea handle insertion
    if (e.key === 'Enter' || e.key === 'Return') {
      if (!isKeyAvailable('\n')) {
        e.preventDefault(); // Prevent if not available
        return;
      }

      // Check if we can still type (not beyond original text length)
      if (hiddenInput.value.length >= originalText.length) {
        e.preventDefault(); // Can't type beyond original text
        return;
      }

      // Let the browser handle the newline insertion naturally
      // Highlight keyboard key if enabled
      if (keyboardEnabled) {
        // Use setTimeout to highlight after the newline is inserted
        setTimeout(() => {
          highlightKey('\n', false);
        }, 0);
      }

      // The input event will fire naturally, no need to manually trigger
      return;
    }

    // Handle Tab key - manually insert tab character
    if (e.key === 'Tab') {
      e.preventDefault(); // Prevent tab from moving focus

      if (!isKeyAvailable('\t')) {
        return; // Key not available, don't insert
      }

      // Check if we can still type (not beyond original text length)
      if (hiddenInput.value.length >= originalText.length) {
        return; // Can't type beyond original text
      }

      // Get current cursor position
      const cursorPos = hiddenInput.selectionStart || hiddenInput.value.length;

      // Insert tab at cursor position
      const currentValue = hiddenInput.value;
      const newValue = currentValue.slice(0, cursorPos) + '\t' + currentValue.slice(cursorPos);

      // Update input value
      hiddenInput.value = newValue;

      // Move cursor after the inserted tab
      setTimeout(() => {
        hiddenInput.setSelectionRange(cursorPos + 1, cursorPos + 1);
      }, 0);

      // Highlight keyboard key if enabled
      if (keyboardEnabled) {
        highlightKey('\t', false);
      }

      // Manually trigger input event to process the tab
      const inputEvent = new Event('input', { bubbles: true });
      hiddenInput.dispatchEvent(inputEvent);

      return;
    }

    // Prevent unavailable keys from being typed
    if (availableKeysSet.size > 0 && !isKeyAvailable(e.key)) {
      e.preventDefault();
      return;
    }

    // Prevent default behavior for backspace when at start
    if (e.key === 'Backspace' && hiddenInput.value.length === 0) {
      e.preventDefault();
    }
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

    // Clear real-time stats interval
    if (realtimeStatsInterval) {
      clearInterval(realtimeStatsInterval);
      realtimeStatsInterval = null;
    }

    // Update real-time stats display
    updateRealtimeStats();

    // Clear keyboard highlights
    if (activeKeyElement) {
      activeKeyElement.classList.remove('active', 'active-error');
      activeKeyElement = null;
    }
    if (activeKeyTimeout) {
      clearTimeout(activeKeyTimeout);
      activeKeyTimeout = null;
    }

    // Show typing container and hide completion screen and stats dashboard
    const typingTextContainer = document.querySelector('.typing-text-container');
    if (typingTextContainer) {
      typingTextContainer.style.display = 'block';
    }
    if (completionScreen) {
      completionScreen.style.display = 'none';
    }
    if (statsDashboard) {
      statsDashboard.style.display = 'none';
    }

    // Show real-time stats again if configured
    if (realtimeStatsContainer) {
      updateRealtimeStats();
    }

    // Show keyboard-stats-wrapper again
    const keyboardStatsWrapper = document.querySelector('.keyboard-stats-wrapper');
    if (keyboardStatsWrapper) {
      keyboardStatsWrapper.style.display = 'block';
    }

    // Show keyboard again if it was enabled
    if (keyboardContainer && keyboardEnabled) {
      keyboardContainer.classList.add('visible');
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

  // Calculate real-time statistics (while typing)
  function calculateRealtimeStats() {
    // Calculate chars typed and total
    const charsTyped = typedText.length;
    const charsTotal = originalText.length;

    if (startTime === null) {
      return {
        speed: 0,
        accuracy: 0,
        time: 0,
        errors: 0,
        errorsLeft: 0,
        chars: { typed: charsTyped, total: charsTotal }
      };
    }

    const currentTime = Date.now();
    const totalTimeSeconds = (currentTime - startTime) / 1000;
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

    return {
      speed: wpm,
      accuracy: accuracy,
      time: totalTimeSeconds,
      errors: totalErrors,
      errorsLeft: errorsLeft,
      chars: { typed: charsTyped, total: charsTotal }
    };
  }

  // Update real-time stats display
  function updateRealtimeStats() {
    if (!realtimeStatsContainer) return;

    // Check if realTimeStats is configured and has items
    if (!config.realTimeStats || !Array.isArray(config.realTimeStats) || config.realTimeStats.length === 0) {
      realtimeStatsContainer.style.display = 'none';
      // Clear interval if stats are disabled
      if (realtimeStatsInterval) {
        clearInterval(realtimeStatsInterval);
        realtimeStatsInterval = null;
      }
      return;
    }

    const stats = calculateRealtimeStats();
    realtimeStatsContainer.style.display = 'flex';

    // Clear existing content
    realtimeStatsContainer.innerHTML = '';

    // Map of stat keys to display info
    const statMap = {
      speed: { label: 'WPM', value: stats.speed, format: (v) => v.toFixed(1) },
      accuracy: { label: 'Accuracy', value: stats.accuracy, format: (v) => v.toFixed(1) + '%' },
      time: { label: 'Time', value: stats.time, format: (v) => {
        if (v < 60) {
          return v.toFixed(1) + 's';
        } else {
          const minutes = Math.floor(v / 60);
          const seconds = (v % 60).toFixed(1);
          return `${minutes}m ${seconds}s`;
        }
      }},
      errors: { label: 'Errors', value: stats.errors, format: (v) => Math.round(v).toString() },
      errorsLeft: { label: 'Errors Left', value: stats.errorsLeft, format: (v) => Math.round(v).toString() },
      chars: { label: 'Chars', value: stats.chars, format: (v) => `${v.typed}/${v.total}` }
    };

    // Create stat items for each configured stat
    config.realTimeStats.forEach(statKey => {
      const statInfo = statMap[statKey];
      if (!statInfo) return; // Skip invalid stat keys

      const statItem = document.createElement('div');
      statItem.className = 'realtime-stat-item';

      const statLabel = document.createElement('span');
      statLabel.className = 'realtime-stat-label';
      statLabel.textContent = statInfo.label;

      const statValue = document.createElement('span');
      statValue.className = 'realtime-stat-value';
      statValue.textContent = statInfo.format(statInfo.value);

      statItem.appendChild(statLabel);
      statItem.appendChild(statValue);
      realtimeStatsContainer.appendChild(statItem);
    });

    // Start periodic updates if typing has started and interval not already running
    if (startTime !== null && !realtimeStatsInterval) {
      realtimeStatsInterval = setInterval(() => {
        updateRealtimeStats();
      }, 100); // Update every 100ms for smooth time updates
    }
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

  // Parse stats from stats.txt file
  function parseStatsText(statsText) {
    const stats = {};
    const lines = statsText.split('\n');

    for (const line of lines) {
      if (line.includes('Total Errors Made:')) {
        const match = line.match(/Total Errors Made:\s*(\d+)/);
        if (match) stats.totalErrors = parseInt(match[1], 10);
      } else if (line.includes('Errors Left (Unfixed):')) {
        const match = line.match(/Errors Left \(Unfixed\):\s*(\d+)/);
        if (match) stats.errorsLeft = parseInt(match[1], 10);
      } else if (line.includes('Total Time:')) {
        const match = line.match(/Total Time:\s*([\d.]+)\s*seconds/);
        if (match) stats.totalTime = parseFloat(match[1]);
      } else if (line.includes('Accuracy:')) {
        const match = line.match(/Accuracy:\s*([\d.]+)%/);
        if (match) stats.accuracy = parseFloat(match[1]);
      } else if (line.includes('Speed:')) {
        const match = line.match(/Speed:\s*([\d.]+)\s*words per minute/);
        if (match) stats.speed = parseFloat(match[1]);
      }
    }

    return stats;
  }

  // Load and display stats dashboard
  async function showStatsDashboard() {
    // Hide typing container
    const typingTextContainer = document.querySelector('.typing-text-container');
    if (typingTextContainer) {
      typingTextContainer.style.display = 'none';
    }

    // Hide the restart button when dashboard is shown
    if (restartButton && restartButton.parentElement) {
      restartButton.parentElement.style.display = 'none';
    }

    // Hide keyboard when dashboard is shown
    if (keyboardContainer) {
      keyboardContainer.classList.remove('visible');
    }

    // Hide real-time stats when dashboard is shown
    if (realtimeStatsContainer) {
      realtimeStatsContainer.style.display = 'none';
    }

    // Hide keyboard-stats-wrapper when dashboard is shown
    const keyboardStatsWrapper = document.querySelector('.keyboard-stats-wrapper');
    if (keyboardStatsWrapper) {
      keyboardStatsWrapper.style.display = 'none';
    }

    // Hide completion screen if visible
    if (completionScreen) {
      completionScreen.style.display = 'none';
    }

    try {
      const response = await fetch('./stats.txt');
      if (!response.ok) {
        console.error('Failed to load stats file');
        // Fall back to simple completion screen
        // Keyboard is already hidden above
        if (completionScreen) {
          completionScreen.style.display = 'flex';
        }
        return;
      }

      const statsText = await response.text();
      const stats = parseStatsText(statsText);

      // Update dashboard with stats
      const speedEl = document.getElementById('stat-speed');
      const accuracyEl = document.getElementById('stat-accuracy');
      const timeEl = document.getElementById('stat-time');
      const errorsEl = document.getElementById('stat-errors');
      const errorsLeftEl = document.getElementById('stat-errors-left');

      if (speedEl) speedEl.textContent = stats.speed ? stats.speed.toFixed(1) : '0';
      if (accuracyEl) accuracyEl.textContent = stats.accuracy ? stats.accuracy.toFixed(1) + '%' : '0%';
      if (timeEl) {
        const timeValue = stats.totalTime || 0;
        if (timeValue < 60) {
          timeEl.textContent = timeValue.toFixed(1) + 's';
        } else {
          const minutes = Math.floor(timeValue / 60);
          const seconds = (timeValue % 60).toFixed(1);
          timeEl.textContent = `${minutes}m ${seconds}s`;
        }
      }
      if (errorsEl) errorsEl.textContent = stats.totalErrors || 0;
      if (errorsLeftEl) errorsLeftEl.textContent = stats.errorsLeft || 0;

      // Show dashboard
      if (statsDashboard) {
        statsDashboard.style.display = 'flex';
      }

      if (hiddenInput) {
        hiddenInput.blur();
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      // Fall back to simple completion screen
      // Keyboard is already hidden above
      if (completionScreen) {
        completionScreen.style.display = 'flex';
      }
    }
  }

  function showCompletionScreen() {
    console.log('showCompletionScreen called');

    // Hide stats dashboard if visible
    if (statsDashboard) {
      statsDashboard.style.display = 'none';
    }

    if (!completionScreen) {
      console.error('Completion screen element not found!');
      return;
    }

    const typingTextContainer = document.querySelector('.typing-text-container');
    if (typingTextContainer) {
      typingTextContainer.style.display = 'none';
    }

    // Hide keyboard when completion screen is shown
    if (keyboardContainer) {
      keyboardContainer.classList.remove('visible');
    }

    // Hide real-time stats when completion screen is shown
    if (realtimeStatsContainer) {
      realtimeStatsContainer.style.display = 'none';
    }

    // Hide keyboard-stats-wrapper when completion screen is shown
    const keyboardStatsWrapper = document.querySelector('.keyboard-stats-wrapper');
    if (keyboardStatsWrapper) {
      keyboardStatsWrapper.style.display = 'none';
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
      saveStatistics(stats).then(() => {
        // After saving, check if we should show stats dashboard
        if (config.showStats === true) {
          // Wait a bit for the file to be written, then show dashboard
          setTimeout(() => {
            showStatsDashboard();
          }, 200);
        } else {
          // Show simple completion screen
          // Ensure real-time stats are hidden
          if (realtimeStatsContainer) {
            realtimeStatsContainer.style.display = 'none';
          }
          completionScreen.style.display = 'flex';
          if (hiddenInput) {
            hiddenInput.blur();
          }
        }
      });
    } else {
      console.log('No statistics to save (stats is null)');
      // Show simple completion screen
      // Ensure real-time stats are hidden
      if (realtimeStatsContainer) {
        realtimeStatsContainer.style.display = 'none';
      }
      completionScreen.style.display = 'flex';
      if (hiddenInput) {
        hiddenInput.blur();
      }
    }
  }

  async function initialize() {
    // Load config first
    await loadConfig();

    textContainer = document.getElementById('typing-text');
    hiddenInput = document.getElementById('hidden-input');
    completionScreen = document.getElementById('completion-screen');
    statsDashboard = document.getElementById('stats-dashboard');
    restartButton = document.getElementById('btn-restart');
    startOverButton = document.getElementById('btn-start-over');
    statsStartOverButton = document.getElementById('btn-stats-start-over');
    realtimeStatsContainer = document.getElementById('realtime-stats-container');

    if (!textContainer || !hiddenInput) {
      console.error('Required elements not found');
      return;
    }

    // Initialize keyboard
    initializeKeyboard();

    // Set up event listeners
    hiddenInput.addEventListener('input', handleInput);
    hiddenInput.addEventListener('keydown', handleKeyDown);

    if (restartButton) {
      restartButton.addEventListener('click', restart);
    }

    if (startOverButton) {
      startOverButton.addEventListener('click', restart);
    }

    if (statsStartOverButton) {
      statsStartOverButton.addEventListener('click', restart);
    }

    // Focus the input when clicking on the text container
    const typingTextContainer = document.querySelector('.typing-text-container');
    if (typingTextContainer) {
      typingTextContainer.addEventListener('click', () => {
        const isCompletionVisible = completionScreen && completionScreen.style.display === 'flex';
        const isStatsVisible = statsDashboard && statsDashboard.style.display === 'flex';
        if (hiddenInput && !isCompletionVisible && !isStatsVisible) {
          hiddenInput.focus();
        }
      });
    }

    // Load the text
    loadText();

    // Initialize real-time stats display
    updateRealtimeStats();

    // Focus the input after a short delay
    setTimeout(() => {
      const isCompletionVisible = completionScreen && completionScreen.style.display === 'flex';
      const isStatsVisible = statsDashboard && statsDashboard.style.display === 'flex';
      if (hiddenInput && !isCompletionVisible && !isStatsVisible) {
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
