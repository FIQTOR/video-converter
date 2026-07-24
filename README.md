
# OptiVideo Pro - Elite Video Transcoding Pipeline ⚡️

OptiVideo Pro is a high-performance, true client-side video transcoding and compression engine built with React, Vite, and FFmpeg WebAssembly. Designed with a sleek, minimalist "Vercel Dark" aesthetic, it empowers developers and users to batch-process heavy video files entirely within the browser—ensuring maximum privacy, zero server costs, and blazing-fast local processing.

## ✨ Features

- **100% Client-Side Processing (WASM):** Your files never leave your device. All encoding and decoding happen locally in your browser using FFmpeg compiled to WebAssembly.
- **Batch Processing:** Drag, drop, and queue multiple video files for sequential processing.
- **Granular Control:** Configure encoding settings globally or per-video in the queue.
- **Advanced Compression Strategies:**
  - **Target Size (MB):** Set a strict target file size, and the engine will automatically read the video duration and calculate the optimal bitrate to hit your target.
  - **Manual (CRF):** Adjust Constant Rate Factor (CRF) for precise control over visual quality and file size.
- **Engine Speed Presets:** Utilize FFmpeg presets (from `ultrafast` to `medium`) to balance encoding time and CPU usage.
- **Extensive Format & Codec Support:** 
  - Containers: `MP4`, `WEBM`, `MKV`, `AVI`, `MOV`, `GIF`.
  - Codecs: `H.264`, `H.265`, `VP9`, `VP8`, `MPEG4`.
- **Resolution & FPS Control:** Scale dimensions (1080p, 720p, 480p) and adjust framerates on the fly.
- **Elite Dark Mode UI:** A distraction-free, developer-centric interface with real-time FFmpeg terminal logs.

## 🛠 Tech Stack

- **Framework:** [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Core Engine:** [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) (`@ffmpeg/ffmpeg`)
- **File Handling:** [JSZip](https://stuk.github.io/jszip/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) (version 16 or higher) and `npm` installed on your system.

### Installation

1. Clone the repository:
```bash
   git clone [https://github.com/FIQTOR/video-converter.git](https://github.com/FIQTOR/video-converter.git)

```

2. Navigate to the project directory:

```bash
cd video-converter

```

3. Install the dependencies:

```bash
npm install

```

*(Note: Ensure you have `lucide-react`, `@ffmpeg/ffmpeg`, `@ffmpeg/util`, and `jszip` installed).*

4. **⚠️ CRITICAL STEP: Setup FFmpeg Core Files**
To bypass Webpack/Vite CORS and Bundler issues, you must manually download the FFmpeg UMD core files and place them in the `public/` folder.
* Download [ffmpeg-core.js](https://www.google.com/search?q=https://unpkg.com/%40ffmpeg/core%400.12.6/dist/umd/ffmpeg-core.js)
* Download [ffmpeg-core.wasm](https://www.google.com/search?q=https://unpkg.com/%40ffmpeg/core%400.12.6/dist/umd/ffmpeg-core.wasm)
* Place both files directly inside the `public/` directory of your project.


5. Start the development server:

```bash
npm run dev
# or npm start

```

6. Open your browser and visit `http://localhost:5173` (or `3000`) to view the application.

## 💡 Usage

1. **Upload:** Drag and drop your video files (recommended < 100MB per file for browser stability) into the drop zone.
2. **Select & Configure:** Click on any video in the queue (left panel) to open its Transcoder Setup (right panel).
3. **Tweak Settings:** Choose your container format, video codec, and compression strategy (Target MB or CRF).
4. **Deploy:** Click **"Mulai Kompresi"** to start the FFmpeg pipeline. You can monitor the real-time process in the Terminal Log UI.
5. **Download:** Once the batch processing is complete, download your optimized assets in a single `.ZIP` file.

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.