# BEKRI AI — بكري

BEKRI is a personal assistant project built around a **local-first privacy model**. Its default language model is Ollama running on the same computer. The application is designed to keep chat, profile, memory, camera processing, and local files on the user's device unless an optional network feature is explicitly enabled.

> This branch is an in-progress migration. It has not yet been packaged as a one-click Windows installer, and a full production build/device test has not yet been completed.

## Current architecture

- **LLM:** BEKRI-owned provider adapter using Ollama's OpenAI-compatible local API.
- **Default chat model:** `qwen2.5:7b`.
- **Vision:** `qwen2.5vl:3b` for local image and camera understanding.
- **Speech input:** optional local `whisper.cpp`; audio is written to a temporary file and removed after processing.
- **Speech output:** browser/OS speech engine by default. A local Piper adapter is a future improvement.
- **Memory and profile:** JSON files under `server/data` on the same computer.
- **Camera and interaction:** browser camera, MediaPipe hand tracking, face detection, gestures, and AR effects. Hand/face tracking models must be installed locally.
- **Books and smart home:** local library and simulated smart-home controls; Home Assistant can be configured separately.
- **Web tools:** news, weather, markets, Wikipedia, YouTube, and online book covers are disabled by default.

## Install

Requirements: Node.js 20+, Git, and [Ollama](https://ollama.com/).

1. Install and start Ollama.
2. Download the local models:

   ```bash
   ollama pull qwen2.5:7b
   ollama pull qwen2.5vl:3b
   ```

3. In the repository root, install dependencies and create the local environment file:

   ```bash
   npm run setup
   ```

4. Download the MediaPipe hand and face models once:

   ```bash
   npm run el-modeli
   ```

   This explicit setup command downloads the model files into `web/public/models`. After that, the app loads them locally and does not silently fetch remote copies.

5. Start the development app:

   ```bash
   npm run dev
   ```

   Open `http://localhost:5173`.

For a production-style local server:

```bash
npm start
```

## Local environment

Edit `server/.env` (created by setup). The privacy-oriented defaults are:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=qwen2.5:7b
VISION_MODEL=qwen2.5vl:3b
TTS_MODEL=browser
CAMERA_ENABLED=1
ENABLE_WEB_FEATURES=0
ENABLE_STUN=0
HOST=127.0.0.1
```

No API key or hosted AI account is required for the default chat and vision setup.

### Optional local speech recognition

Install `whisper.cpp` and download a Whisper model file yourself. Then set:

```env
WHISPER_CPP_PATH=whisper-cli
WHISPER_MODEL_PATH=C:/path/to/ggml-base.bin
FFMPEG_PATH=ffmpeg
```

FFmpeg is needed to convert browser-recorded WebM/MP4 audio to 16 kHz mono WAV. If the Whisper model path is empty, server-side speech recognition reports that it is not configured; it does not send recordings to a cloud service.

## Privacy defaults

- The server binds to `127.0.0.1` by default and is not exposed to the local network.
- If you change `HOST` to a non-loopback address, `ACCESS_TOKEN` is required at startup.
- News, weather, currency, Wikipedia, YouTube, stock-photo search, online book covers, and ElevenLabs are opt-in. They remain disabled unless `ENABLE_WEB_FEATURES=1`.
- Public STUN is disabled by default. Set `ENABLE_STUN=1` only if you intentionally need remote-network WebRTC camera connections.
- Google Fonts are not loaded from the web. MediaPipe tracking models are loaded from local files.
- Camera frames are held in server memory for the active camera session and are not written to disk by the camera module.
- Profile, memory, conversation state, and library data are stored locally under `server/data`.

**Important limits:** local storage is not the same as encryption. Files under `server/data` are not yet encrypted at rest; anyone who can access your Windows account or disk may be able to read them. Use a private Windows account and device encryption. A passphrase-based encrypted data store is a future security task. If you expose the app through a tunnel or another device, it is no longer strictly local-only.

## Existing assistant features

- Arabic (Syrian dialect / MSA) and Turkish conversation.
- Streaming replies, conversation history, personal profile, and editable memory.
- Local image understanding and camera questions when a compatible vision model is installed.
- Hand tracking, face *detection* (not identity recognition), gestures, holographic-style effects, and book-shelf interaction.
- Book library, reading status, summaries, and personal notes.
- Simulated smart-home controls; optional Home Assistant integration.
- Optional news, weather, currency, Wikipedia, and YouTube tools after enabling web features.

Some integrations depend on optional models, permissions, or external devices and still require real-device testing.

## Development checks

```bash
npm run test
npm run models
npm run test:kitaplik
```

With `ENABLE_WEB_FEATURES=0`, the test script skips RSS network checks and tests the local model connection. `npm run models` lists models exposed by the local Ollama endpoint.

## Repository visibility and licensing

The working branch is:

`bekri-independent-core`

The repository itself is currently **Public**. To make the source private, change repository visibility in GitHub:

**Repository → Settings → General → Danger Zone → Change repository visibility → Private.**

The original upstream source did not include a clear root-level license during the initial review. Making a repository private does not grant permission to redistribute or relicense upstream code. Before distributing BEKRI as closed-source software, verify the upstream rights or obtain the necessary permission.
