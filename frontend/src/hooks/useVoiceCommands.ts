import { useCallback, useEffect, useRef, useState } from "react";

type VoiceCommand = {
  patterns: RegExp[];
  action: () => void;
  feedback: string;
};

export function useVoiceCommands(
  commands: VoiceCommand[],
  getAiResponse?: (query: string) => Promise<string | null>,
  onTranscript?: (text: string, isFinal: boolean) => void,
) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [lastAiResponse, setLastAiResponse] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const getAiResponseRef = useRef(getAiResponse);
  const commandsRef = useRef(commands);
  onTranscriptRef.current = onTranscript;
  getAiResponseRef.current = getAiResponse;
  commandsRef.current = commands;

  const stopRecognition = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const speakAndPause = useCallback((text: string) => {
    stopRecognition();
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1;
    utterance.onend = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      if (isListeningRef.current) {
        setupRecognitionAndStart();
      }
    };
    window.speechSynthesis.speak(utterance);
  }, [stopRecognition]);

  function setupRecognitionAndStart() {
    const SpeechRecognitionAPI =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    try {
      const recognition = new (SpeechRecognitionAPI as new () => SpeechRecognition)();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognitionRef.current = recognition;

      let finalTranscriptBuffer = "";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (isSpeakingRef.current) return;
        let interimTranscript = "";
        let newFinal = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const t = result[0].transcript;
            newFinal += t;
            finalTranscriptBuffer += t;
            onTranscriptRef.current?.(t, true);
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        if (interimTranscript) {
          onTranscriptRef.current?.(interimTranscript, false);
        }
        if (newFinal) {
          const text = finalTranscriptBuffer.toLowerCase().trim();
          finalTranscriptBuffer = "";
          setTranscript(text);
          const cmds = commandsRef.current;
          let matchedCmd: VoiceCommand | undefined;
          for (const cmd of cmds) {
            if (cmd.patterns.some((p) => p.test(text))) {
              cmd.action();
              setLastCommand(cmd.feedback);
              matchedCmd = cmd;
              break;
            }
          }
          if (matchedCmd) {
            speakAndPause(matchedCmd.feedback);
          } else {
            getAiResponseRef.current?.(text).then((answer) => {
              if (answer) {
                setLastAiResponse(answer);
                speakAndPause(answer);
              }
            });
          }
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognition.onend = () => {
        if (isListeningRef.current && !isSpeakingRef.current) {
          try { recognition.start(); } catch {
            setIsListening(false);
            isListeningRef.current = false;
          }
        }
      };

      recognition.start();
      setIsListening(true);
      isListeningRef.current = true;
    } catch {
      setIsListening(false);
      isListeningRef.current = false;
    }
  }

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopRecognition();
      setIsListening(false);
      isListeningRef.current = false;
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    } else {
      setTranscript("");
      setLastAiResponse(null);
      setupRecognitionAndStart();
      speakAndPause("Voice control activated.");
    }
  }, [stopRecognition, speakAndPause]);

  useEffect(() => {
    return () => {
      stopRecognition();
      window.speechSynthesis.cancel();
    };
  }, [stopRecognition]);

  return { isListening, toggleListening, transcript, lastCommand, lastAiResponse, isSpeaking };
}
