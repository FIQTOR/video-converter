import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import JSZip from 'jszip';
import {
    UploadCloud, Settings, Film, X, Check,
    Sliders, Download, ArrowRight, Trash2, Activity, Terminal
} from 'lucide-react';

export default function VideoCompressor() {
    const [files, setFiles] = useState([]);
    const [selectedFileId, setSelectedFileId] = useState(null);

    // FFmpeg State
    const ffmpegRef = useRef(new FFmpeg());
    const [isFfmpegLoaded, setIsFfmpegLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingDone, setProcessingDone] = useState(false);
    const [activeLog, setActiveLog] = useState("Memuat FFmpeg Engine...");
    const [zipUrl, setZipUrl] = useState(null);

    // Konfigurasi Baru yang Lebih Lengkap
    const SUPPORTED_FORMATS = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'gif'];
    const SUPPORTED_CODECS = ['h264', 'h265', 'vp9', 'vp8', 'mpeg4'];
    const FPS_OPTIONS = ['24', '30', '60', 'Original'];
    const RES_OPTIONS = ['1080', '720', '480', 'Original'];
    const PRESET_OPTIONS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'];

    const defaultSettings = {
        format: 'mp4',
        codec: 'h264',
        mode: 'crf', // 'crf' atau 'target_size'
        crf: 28,
        targetSizeMB: 10,
        fps: 'Original',
        resolution: 'Original',
        preset: 'superfast' // Default lebih cepat
    };

    // --- 1. LOAD FFMPEG CORE ---
    useEffect(() => {
        const loadFFmpeg = async () => {
            const ffmpeg = ffmpegRef.current;
            ffmpeg.on('log', ({ message }) => {
                setActiveLog(message);
            });

            try {
                await ffmpeg.load({
                    coreURL: '/ffmpeg-core.js',
                    wasmURL: '/ffmpeg-core.wasm',
                });
                setIsFfmpegLoaded(true);
                setActiveLog("Engine Core siap digunakan!");
            } catch (err) {
                console.error("Error loading FFmpeg:", err);
                setActiveLog("ERROR: Pastikan file ffmpeg-core.js dan .wasm ada di folder public/!");
            }
        };

        if (!ffmpegRef.current.loaded) {
            loadFFmpeg();
        }
    }, []);

    // --- 2. FILE MANAGEMENT & DURATION EXTRACTOR ---
    // Ekstrak durasi video secara instan via browser API
    const getVideoDuration = (file) => {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                URL.revokeObjectURL(video.src);
                resolve(video.duration);
            };
            video.src = URL.createObjectURL(file);
        });
    };

    const addFiles = async (fileList) => {
        const validFiles = Array.from(fileList).filter(file => file.type.startsWith('video/'));

        // Looping untuk mendapatkan metadata (durasi) setiap file
        const newFiles = await Promise.all(validFiles.map(async (file) => {
            const duration = await getVideoDuration(file);
            return {
                id: Math.random().toString(36).substr(2, 9),
                file,
                name: file.name,
                size: (file.size / (1024 * 1024)).toFixed(2),
                duration: duration,
                status: 'ready',
                outputSize: null,
                progress: 0,
                settings: { ...defaultSettings }
            };
        }));

        setFiles(prev => {
            const updatedFiles = [...prev, ...newFiles];
            if (!selectedFileId && updatedFiles.length > 0) setSelectedFileId(updatedFiles[0].id);
            return updatedFiles;
        });
        setProcessingDone(false);
        if (zipUrl) URL.revokeObjectURL(zipUrl);
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length > 0) addFiles(e.dataTransfer.files);
    }, [selectedFileId]);

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files?.length > 0) addFiles(e.target.files);
    };

    const removeFile = (id) => {
        setFiles(prev => {
            const filtered = prev.filter(f => f.id !== id);
            if (selectedFileId === id) setSelectedFileId(filtered.length > 0 ? filtered[0].id : null);
            return filtered;
        });
    };

    const clearAllFiles = () => {
        setFiles([]);
        setSelectedFileId(null);
        setProcessingDone(false);
        setActiveLog("Antrean dibersihkan.");
        if (zipUrl) URL.revokeObjectURL(zipUrl);
    };

    const updateActiveSettings = (key, value) => {
        if (!selectedFileId) return;
        setFiles(prev => prev.map(f => f.id === selectedFileId ? { ...f, settings: { ...f.settings, [key]: value } } : f));
    };

    // --- 3. FFMPEG PROCESSING LOGIC ---
    const handleProcessVideos = async () => {
        if (files.length === 0 || !isFfmpegLoaded) return;
        setIsProcessing(true);
        setProcessingDone(false);

        const ffmpeg = ffmpegRef.current;
        const zip = new JSZip();

        try {
            for (let i = 0; i < files.length; i++) {
                const item = files[i];

                setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'converting', progress: 0 } : f));

                const inputName = `input_${i}_${item.name.replace(/\s+/g, '_')}`;
                const outputExt = item.settings.format;
                const outputName = `output_${i}.${outputExt}`;

                await ffmpeg.writeFile(inputName, await fetchFile(item.file));

                const args = ['-i', inputName];

                // --- Pengaturan Codec Video ---
                if (outputExt === 'gif') {
                    // Optimasi GIF
                    args.push('-vf', 'fps=15,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse');
                } else {
                    if (item.settings.codec === 'h264') args.push('-c:v', 'libx264');
                    if (item.settings.codec === 'h265') args.push('-c:v', 'libx265');
                    if (item.settings.codec === 'vp9') args.push('-c:v', 'libvpx-vp9');
                    if (item.settings.codec === 'vp8') args.push('-c:v', 'libvpx');
                    if (item.settings.codec === 'mpeg4') args.push('-c:v', 'mpeg4');

                    // --- Pengaturan Kompresi (Mode Target MB vs CRF) ---
                    if (item.settings.mode === 'target_size' && item.duration) {
                        // Rumus Bitrate: (Ukuran MB * 8192) / Durasi Detik = kbps
                        // Kita kurangi 128kbps untuk memberikan ruang bagi bitrate audio
                        const targetVideoBitrate = Math.max(100, Math.floor((item.settings.targetSizeMB * 8192) / item.duration) - 128);

                        args.push('-b:v', `${targetVideoBitrate}k`);
                        args.push('-maxrate', `${targetVideoBitrate * 1.5}k`);
                        args.push('-bufsize', `${targetVideoBitrate * 2}k`);
                        setActiveLog(`Mengunci target ukuran ~${item.settings.targetSizeMB}MB (${targetVideoBitrate} kbps)...`);
                    } else {
                        args.push('-crf', String(item.settings.crf));
                    }

                    // --- Pengaturan Kecepatan (Preset) ---
                    if (item.settings.codec === 'h264' || item.settings.codec === 'h265') {
                        args.push('-preset', item.settings.preset);
                    }

                    // --- Resolusi & FPS ---
                    if (item.settings.resolution !== 'Original') {
                        args.push('-vf', `scale=-2:${item.settings.resolution}`);
                    }
                    if (item.settings.fps !== 'Original') {
                        args.push('-r', item.settings.fps);
                    }

                    // Faststart untuk streaming web (khusus mp4/mov)
                    if (outputExt === 'mp4' || outputExt === 'mov') {
                        args.push('-movflags', '+faststart');
                    }
                }

                args.push(outputName);

                // Tracking Progress
                ffmpeg.on('progress', ({ progress }) => {
                    const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
                    setFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress: percent } : f));
                });

                // Eksekusi FFmpeg
                await ffmpeg.exec(args);

                // Ambil hasil
                const data = await ffmpeg.readFile(outputName);
                const finalName = `optimized_${item.name.split('.')[0]}.${outputExt}`;
                zip.file(finalName, data.buffer);

                const outSizeMB = (data.buffer.byteLength / (1024 * 1024)).toFixed(2);

                await ffmpeg.deleteFile(inputName);
                await ffmpeg.deleteFile(outputName);

                setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'success', progress: 100, outputSize: outSizeMB } : f));
            }

            setActiveLog("Membungkus file ke dalam ZIP...");
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            setZipUrl(url);

            setIsProcessing(false);
            setProcessingDone(true);
            setActiveLog("Selesai! Silakan download hasilnya.");

        } catch (error) {
            console.error(error);
            setActiveLog("ERROR: Pemrosesan gagal. Cek log console.");
            setIsProcessing(false);
        }
    };

    const handleDownloadZip = () => {
        if (!zipUrl) return;
        const link = document.createElement('a');
        link.href = zipUrl;
        link.download = 'optimized_videos.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const activeFile = files.find(f => f.id === selectedFileId);

    // --- 4. RENDER UI ---
    return (
        <div className="min-h-screen bg-black text-[#EDEDED] font-sans antialiased pb-20 lg:pb-0">
            <nav className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3 font-semibold text-sm tracking-tight text-white">
                        <div className="w-7 h-7 bg-white text-black flex items-center justify-center rounded-[4px]">
                            <Film className="w-4 h-4" />
                        </div>
                        OptiVideo Pro
                        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-[4px] border border-emerald-500/20 tracking-wider uppercase">
                            Engine v2
                        </span>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Bagian Kiri */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">Advanced Transcoding Pipeline</h1>
                        <p className="text-[14px] text-[#A1A1AA]">Mendukung target bitrate adaptif & kompresi multi-format lokal.</p>
                    </div>

                    <div
                        className="relative flex flex-col items-center justify-center py-12 px-6 border border-white/15 border-dashed rounded-lg bg-black hover:border-white/30 hover:bg-white/[0.02] transition-all"
                        onDragEnter={(e) => e.preventDefault()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <input type="file" id="file-upload" className="hidden" onChange={handleChange} accept="video/*" multiple />
                        <UploadCloud className="w-8 h-8 text-white mb-4 opacity-70" />
                        <h3 className="text-[14px] font-semibold text-white mb-1">Queue media files</h3>
                        <p className="text-[13px] text-[#A1A1AA] mb-5 text-center">Drag & drop video ke sini.</p>
                        <label htmlFor="file-upload" className="cursor-pointer bg-white text-black hover:bg-gray-200 text-[13px] font-medium py-2 px-5 rounded-md transition-all">
                            Pilih Video
                        </label>
                    </div>

                    <div className="border border-white/10 rounded-lg bg-[#000] p-4 font-mono text-[12px] text-[#A1A1AA] shadow-inner flex flex-col gap-2">
                        <div className="flex items-center gap-2 mb-1 text-white">
                            <Terminal className="w-3.5 h-3.5" />
                            <span className="font-semibold">FFmpeg Runtime Log</span>
                        </div>
                        <p className={`${isProcessing ? 'animate-pulse text-emerald-400' : 'text-[#888]'}`}>
                            {'> '}{activeLog}
                        </p>
                    </div>

                    {files.length > 0 && (
                        <div className="border border-white/10 rounded-lg bg-[#0A0A0A] overflow-hidden">
                            <div className="flex justify-between items-center p-3 border-b border-white/10 bg-[#111]">
                                <div className="flex items-center gap-2 text-[12px] font-mono text-[#A1A1AA] uppercase tracking-wider">
                                    <Activity className="w-3.5 h-3.5" />
                                    <span>Pipeline • {files.length}</span>
                                </div>
                                <button onClick={clearAllFiles} disabled={isProcessing} className="text-[12px] text-[#A1A1AA] hover:text-red-400 flex items-center gap-1 transition-colors disabled:opacity-50">
                                    <Trash2 className="w-3.5 h-3.5" /> Clear
                                </button>
                            </div>

                            <div className="divide-y divide-white/5 max-h-[450px] overflow-y-auto">
                                {files.map((item) => (
                                    <div key={item.id} onClick={() => !isProcessing && setSelectedFileId(item.id)} className={`p-3 relative flex items-center justify-between transition-all group ${selectedFileId === item.id ? 'bg-white/10 border-l-2 border-white' : 'hover:bg-white/5 border-l-2 border-transparent cursor-pointer'}`}>
                                        {item.status === 'converting' && (
                                            <div className="absolute top-0 left-0 h-full bg-white/5 transition-all duration-200 z-0" style={{ width: `${item.progress}%` }} />
                                        )}
                                        <div className="flex items-center gap-3 overflow-hidden flex-1 relative z-10">
                                            <Film className={`w-4 h-4 flex-shrink-0 ${selectedFileId === item.id ? 'text-white' : 'text-[#888]'}`} />
                                            <div className="flex flex-col min-w-0">
                                                <p className={`text-[13px] font-medium truncate ${selectedFileId === item.id ? 'text-white' : 'text-[#EDEDED]'}`}>{item.name}</p>
                                                <p className="text-[10px] font-mono text-[#888] mt-0.5 truncate flex items-center gap-1.5">
                                                    <span>{item.settings.format.toUpperCase()}</span>
                                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                                    <span>{item.settings.codec.toUpperCase()}</span>
                                                    {item.duration && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-white/20" />
                                                            <span>{Math.round(item.duration)}s</span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-5 pl-2 flex-shrink-0 relative z-10">
                                            <div className="text-[12px] font-mono text-[#888] flex items-center gap-2">
                                                <span className={item.settings.mode === 'target_size' ? 'text-emerald-500' : ''}>{item.size} MB</span>
                                                {item.outputSize && (
                                                    <div className="flex items-center gap-1">
                                                        <ArrowRight className="w-3 h-3 text-[#555]" />
                                                        <span className="text-white font-semibold">{item.outputSize} MB</span>
                                                    </div>
                                                )}
                                                {item.status === 'converting' && <span className="text-emerald-400 ml-2">{item.progress}%</span>}
                                            </div>
                                            <div className="w-10 flex justify-end items-center">
                                                {item.status === 'converting' && <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                                                {item.status === 'success' && <Check className="w-4 h-4 text-emerald-400" />}
                                                {item.status === 'ready' && <button onClick={(e) => { e.stopPropagation(); removeFile(item.id); }} className="text-[#555] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Bagian Kanan */}
                <div className="lg:col-span-4">
                    <div className="border border-white/10 rounded-lg bg-[#0A0A0A] lg:sticky lg:top-20 flex flex-col shadow-xl">
                        <div className="p-4 border-b border-white/10 flex items-center gap-2 bg-[#111] rounded-t-lg">
                            <Settings className="w-4 h-4 text-white" />
                            <h2 className="text-[13px] font-semibold text-white">Transcoder Setup</h2>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar min-h-[300px]">
                            {!activeFile ? (
                                <div className="h-full flex flex-col items-center justify-center text-center text-[#888] space-y-3 py-10">
                                    <Sliders className="w-8 h-8 opacity-20" />
                                    <p className="text-[13px]">Pilih file media<br />untuk mengatur konfigurasi.</p>
                                </div>
                            ) : (
                                <div className={`space-y-6 ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>

                                    {/* Format & Codec */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[12px] font-semibold text-[#EDEDED]">Format / Container</label>
                                            <select value={activeFile.settings.format} onChange={(e) => updateActiveSettings('format', e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-md py-1.5 px-3 text-[12px] text-white focus:outline-none focus:border-white">
                                                {SUPPORTED_FORMATS.map(fmt => <option key={fmt} value={fmt}>.{fmt.toUpperCase()}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[12px] font-semibold text-[#EDEDED]">Video Codec</label>
                                            <select
                                                value={activeFile.settings.format === 'gif' ? 'gif' : activeFile.settings.codec}
                                                disabled={activeFile.settings.format === 'gif'}
                                                onChange={(e) => updateActiveSettings('codec', e.target.value)}
                                                className="w-full bg-[#111] border border-white/10 rounded-md py-1.5 px-3 text-[12px] text-white focus:outline-none focus:border-white disabled:opacity-50"
                                            >
                                                {activeFile.settings.format === 'gif'
                                                    ? <option value="gif">GIF</option>
                                                    : SUPPORTED_CODECS.map(codec => <option key={codec} value={codec}>{codec.toUpperCase()}</option>)
                                                }
                                            </select>
                                        </div>
                                    </div>

                                    {/* Compression Strategy */}
                                    <div className="space-y-4 border border-white/10 rounded-md p-3 bg-white/[0.02]">
                                        <div className="flex gap-4 border-b border-white/10 pb-3">
                                            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                                                <input type="radio" checked={activeFile.settings.mode === 'target_size'} onChange={() => updateActiveSettings('mode', 'target_size')} className="accent-emerald-500" />
                                                <span className={activeFile.settings.mode === 'target_size' ? 'text-white font-medium' : 'text-[#888]'}>Target MB</span>
                                            </label>
                                            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                                                <input type="radio" checked={activeFile.settings.mode === 'crf'} onChange={() => updateActiveSettings('mode', 'crf')} className="accent-emerald-500" />
                                                <span className={activeFile.settings.mode === 'crf' ? 'text-white font-medium' : 'text-[#888]'}>Manual (CRF)</span>
                                            </label>
                                        </div>

                                        {activeFile.settings.mode === 'target_size' ? (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[12px] font-semibold text-emerald-400">Target File Size (MB)</label>
                                                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">{activeFile.settings.targetSizeMB} MB</span>
                                                </div>
                                                <input type="range" min="1" max={Math.ceil(activeFile.size)} step="0.5" value={activeFile.settings.targetSizeMB} onChange={(e) => updateActiveSettings('targetSizeMB', Number(e.target.value))} className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                                                <p className="text-[10px] text-[#888] leading-tight">Sistem akan menghitung bitrate otomatis berdasarkan durasi video.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[12px] font-semibold text-[#EDEDED]">Compression (CRF)</label>
                                                    <span className="text-[11px] font-mono text-[#A1A1AA] bg-white/10 px-1.5 py-0.5 rounded">Val: {activeFile.settings.crf}</span>
                                                </div>
                                                <input type="range" min="0" max="51" value={activeFile.settings.crf} onChange={(e) => updateActiveSettings('crf', e.target.value)} className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-white" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Engine Speed Preset */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[12px] font-semibold text-[#EDEDED]">Kecepatan Proses (Preset)</label>
                                        </div>
                                        <select value={activeFile.settings.preset} onChange={(e) => updateActiveSettings('preset', e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-md py-1.5 px-3 text-[12px] text-white focus:outline-none focus:border-white">
                                            {PRESET_OPTIONS.map(preset => (
                                                <option key={preset} value={preset}>
                                                    {preset.charAt(0).toUpperCase() + preset.slice(1)} {preset === 'superfast' ? '(Recommended)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <hr className="border-white/10" />

                                    {/* Res & FPS */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[12px] font-semibold text-[#EDEDED]">Resolusi</label>
                                            <select value={activeFile.settings.resolution} onChange={(e) => updateActiveSettings('resolution', e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-md py-1.5 px-3 text-[12px] text-white focus:outline-none focus:border-white">
                                                {RES_OPTIONS.map(res => <option key={res} value={res}>{res === 'Original' ? res : `${res}p`}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[12px] font-semibold text-[#EDEDED]">Framerate</label>
                                            <select value={activeFile.settings.fps} onChange={(e) => updateActiveSettings('fps', e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-md py-1.5 px-3 text-[12px] text-white focus:outline-none focus:border-white">
                                                {FPS_OPTIONS.map(fps => <option key={fps} value={fps}>{fps === 'Original' ? fps : `${fps} FPS`}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-white/10 bg-[#111] rounded-b-lg shrink-0">
                            {processingDone ? (
                                <button onClick={handleDownloadZip} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-[13px] font-medium bg-emerald-500 hover:bg-emerald-600 text-black transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                                    <Download className="w-4 h-4" /> Download Final ZIP
                                </button>
                            ) : (
                                <button onClick={handleProcessVideos} disabled={files.length === 0 || isProcessing || !isFfmpegLoaded} className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-[13px] font-medium transition-all ${files.length === 0 || !isFfmpegLoaded ? 'bg-white/5 text-[#555] cursor-not-allowed' : isProcessing ? 'bg-white/10 text-white cursor-wait' : 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-[0_0_15px_rgba(16,185,129,0.15)]'}`}>
                                    {isProcessing ? (
                                        <><div className="w-4 h-4 border-2 border-emerald-900 border-t-black rounded-full animate-spin" /> Sedang Memproses...</>
                                    ) : !isFfmpegLoaded ? (
                                        'Loading Core Engine...'
                                    ) : (
                                        <><UploadCloud className="w-4 h-4" /> Mulai Kompresi</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}