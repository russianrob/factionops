import { j as browser, l as isSpeechSynthesisAvailable } from "./utilities-DwImhkRX.js";
//#region src/extension/entrypoints/offscreen/offscreen.ts
var audio;
function playAudio({ src, volume }) {
	if (!audio || audio.src !== src) audio = new Audio(src);
	audio.volume = volume;
	audio.currentTime = 0;
	audio.play();
}
function playTTS({ text, volume, voice, rate }) {
	if (!isSpeechSynthesisAvailable()) throw new Error("Speech is disabled in the browser.");
	const ttsMessage = new SpeechSynthesisUtterance(text);
	ttsMessage.volume = volume;
	if (voice !== "default") {
		const matchedVoice = window.speechSynthesis.getVoices().find(({ name, lang }) => `${name} (${lang})` === voice);
		if (matchedVoice) ttsMessage.voice = matchedVoice;
	}
	ttsMessage.rate = rate;
	window.speechSynthesis.speak(ttsMessage);
}
browser.runtime.onMessage.addListener((message) => {
	if (message.offscreen === "audio") playAudio(message);
	else if (message.offscreen === "tts") playTTS(message);
});
//#endregion

//# sourceMappingURL=offscreen-GGnRTZEp.js.map