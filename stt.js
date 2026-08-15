// stt.js — Speech-to-Text for TTS Looper
// Uses the browser's built-in SpeechRecognition API (no backend, no API key needed)

(function () {
  const textBox = document.getElementById("text-box");
  const recordBtn = document.getElementById("record-btn");

  if (!textBox || !recordBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    recordBtn.textContent = "🎤 Not supported";
    recordBtn.disabled = true;
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let isListening = false;

  recognition.onresult = (event) => {
    let finalTranscript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }
    if (finalTranscript) {
      // Append recognized speech to whatever is already in the box
      textBox.value += (textBox.value.endsWith(" ") || textBox.value === "" ? "" : " ") + finalTranscript.trim() + " ";
      textBox.dispatchEvent(new Event("input")); // triggers char counter / timer updates if listening for input
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    stopListening();
  };

  recognition.onend = () => {
    // Restart automatically if user hasn't manually stopped (keeps it running like continuous dictation)
    if (isListening) {
      recognition.start();
    }
  };

  function startListening() {
    isListening = true;
    recognition.start();
    recordBtn.textContent = "⏹ Stop Recording";
    recordBtn.classList.add("recording");
  }

  function stopListening() {
    isListening = false;
    recognition.stop();
    recordBtn.textContent = "🎤 Record";
    recordBtn.classList.remove("recording");
  }

  recordBtn.addEventListener("click", () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });
})();