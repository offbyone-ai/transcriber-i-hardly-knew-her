# Transcription System Documentation

Complete technical reference for the Whisper AI transcription system.

---

## Architecture Overview

The transcription system is built on a Web Worker architecture using @huggingface/transformers for browser-based WASM execution. This ensures non-blocking UI during heavy ML operations.

```
User clicks "Start Transcription"
    ↓
Retrieve audio blob from IndexedDB
    ↓
Convert audio to Float32Array (resample to 16kHz)
    ↓
Send to Web Worker
    ↓
Worker loads/downloads Whisper model
    ↓
Worker runs inference on audio
    ↓
Worker returns text + word-level timestamps
    ↓
Save to IndexedDB
    ↓
Display in UI
```

---

## Core Files

### Main Transcription Logic
**File:** `client/src/lib/transcription.ts` (301 lines)

#### Key Functions

**`transcribeAudio()`**
- **Purpose:** Main entry point for transcription
- **Parameters:**
  - `audioBlob: Blob` - Audio file from recording
  - `model: WhisperModel` - Model selection (tiny, base, small)
  - `onProgress: (progress: TranscriptionProgress) => void` - Progress callback
- **Returns:** `Promise<TranscriptionResult>`
- **Process:**
  1. Convert blob to Float32Array
  2. Verify worker exists (create if needed)
  3. Send audio to worker
  4. Listen for progress events
  5. Return final transcription

**`convertAudioForWhisper()`**
- **Purpose:** Prepare audio for model input
- **Parameters:** `audioBlob: Blob`
- **Returns:** `Float32Array`
- **Details:**
  - Creates AudioContext
  - Decodes audio data
  - Resamples to 16kHz
  - Converts stereo to mono
  - Cleans up resources

**`initWorker()`**
- **Purpose:** Create and configure Web Worker
- **Returns:** `Worker`
- **Features:**
  - Uses ES module worker
  - Singleton pattern (only one worker)
  - Proper error handling

**`RealtimeTranscriber` Class**
- **Purpose:** Transcribe while recording (experimental)
- **Key Methods:**
  - `addChunk(samples: Float32Array)` - Add audio chunk
  - `finish()` - Complete transcription
  - `onChunkComplete` - Callback for results
- **Use Case:** Real-time subtitles during recording

### Web Worker Implementation
**File:** `client/src/workers/transcription.worker.ts` (141 lines)

#### Worker Architecture

**Initialization**
- Dynamic import of transformers.js (lazy loading)
- Singleton pipeline pattern for models
- CORS configuration for model downloads
- Environment setup for browser WASM

**Message Handler**
```typescript
self.onmessage = async (event) => {
  const { type, audioData, model } = event.data
  
  if (type === 'transcribe') {
    // Load model
    // Run inference
    // Send results back
  }
}
```

**Model Management**
- Models cached in browser IndexedDB
- First use triggers automatic download (75-250MB)
- Subsequent uses load from cache
- Progress events for download UI

**Inference Pipeline**
1. Load selected model (tiny.en, base.en, or small.en)
2. Create pipeline with model
3. Run transcription on audio
4. Extract text and timestamps
5. Chunk audio (30s chunks, 5s stride)
6. Send progress updates
7. Return final result

#### Progress Events

Worker sends progress events:
```typescript
// Initialization
{ type: 'progress', status: 'Loading model...', progress: 30 }

// Processing
{ type: 'progress', status: 'Transcribing...', progress: 60 }

// Complete
{ type: 'done', result: { text: '...', chunks: [...] } }

// Error
{ type: 'error', error: 'Error message' }
```

### Audio Processing
**File:** `client/src/lib/audio-processing.ts`

#### Functions

**`convertAudioForWhisper(audioBlob)`**
- Decodes audio using Web Audio API
- Creates OfflineAudioContext for processing
- Resamples to 16kHz (required by Whisper)
- Converts stereo to mono
- Returns Float32Array

**`resampleAudio(audioBuffer, targetSampleRate)`**
- Creates OfflineAudioContext
- Connects source with target sample rate
- Returns resampled audio buffer

**`calculateDuration(samples, sampleRate)`**
- Calculates duration from sample count
- Formula: `duration = samples / sampleRate`
- Used for metadata

#### Test Coverage
- 4 unit tests in `audio-processing.test.ts`
- Tests: duration calculation, resampling, conversion
- All passing

### Model Management
**File:** `client/src/lib/model-manager.ts`

#### Functions

**`downloadModel(model, onProgress)`**
- **Purpose:** Manual model download (not currently used)
- **Parameters:**
  - `model: WhisperModel`
  - `onProgress: (progress: number) => void`
- **Returns:** `Promise<void>`
- **Note:** transformers.js handles downloads automatically

**`isModelDownloaded(model)`**
- Check if model exists in local cache
- Uses browser storage API

**`getModelsList()`**
- Return all available models with metadata
- Includes: size, speed estimate, accuracy rating

**`getPreferredModel()`**
- Retrieve user's selected model from localStorage
- Default: base.en

**`setPreferredModel(model)`**
- Save user's model preference
- Used in Settings page

---

## Available Models

### Model Comparison

| Model | Size | Speed | Accuracy | Language | Use Case |
|-------|------|-------|----------|----------|----------|
| tiny.en | ~40MB | Fastest | Basic | English | Quick tests, low-bandwidth |
| base.en | ~75MB | Fast | Good | English | General use (recommended) |
| small.en | ~250MB | Slower | Best | English | Professional, important audio |

### Model Selection

**Default:** base.en (good balance of speed and accuracy)

**For Testing:** tiny.en (fast downloads, suitable for quick tests)

**For Important Recordings:** small.en (most accurate, larger model)

**User Selection:** Settings page allows model override

### Download Behavior

**First Transcription with Model:**
- User clicks "Start Transcription"
- Worker checks for cached model
- Model not found, begins download
- Progress shown in UI (30-90 seconds)
- Model cached in browser storage (~40-250MB)

**Subsequent Transcriptions:**
- Model found in cache
- Instant start (no download)
- Faster processing (5-30 seconds)

### Storage Location

**Browser Cache:**
- Model files stored in browser's local storage
- Location varies by browser (Chrome, Firefox, Safari)
- Persistent until browser cache cleared
- Per-origin isolation for security

---

## Usage Flow

### Basic Transcription Flow

**1. User Starts Transcription**
```typescript
// In RecordingDetailPage
const handleTranscribe = async () => {
  try {
    setProgress(0)
    setTranscribing(true)
    
    const result = await transcribeAudio(
      audioBlob,
      selectedModel,
      (progress) => setProgress(progress.progress)
    )
    
    // Save to database
    await db.transcriptions.add({
      recordingId: id,
      userId: session.user.id,
      text: result.text,
      segments: result.chunks,
      modelUsed: selectedModel,
      createdAt: new Date()
    })
    
    setTranscription(result)
  } catch (error) {
    setError(error.message)
  } finally {
    setTranscribing(false)
  }
}
```

**2. Audio Conversion**
- Blob → Float32Array
- Resampled to 16kHz
- Sent to worker

**3. Worker Processing**
- Loads model (or retrieves from cache)
- Shows download progress if needed
- Runs inference
- Returns chunks with timestamps

**4. Result Display**
- Save to IndexedDB
- Display transcription text
- Show segments with timestamps
- Allow copying/editing

### Real-time Transcription (Experimental)

```typescript
// In RecordingPage
const transcriber = new RealtimeTranscriber(
  selectedModel,
  (chunk) => {
    // Update UI with new transcription chunk
    setLiveTranscription(prev => prev + ' ' + chunk.text)
  }
)

// While recording
audioAnalyzer.onChunk = (samples) => {
  transcriber.addChunk(samples)
}

// On stop recording
await transcriber.finish()
```

---

## Error Handling

### Common Errors & Solutions

**Error: "SharedArrayBuffer is not defined"**
- Cause: Vite CORS headers not set
- Solution: Restart dev server
- Verification: Check vite.config.ts has headers

**Error: "Failed to fetch model"**
- Cause: Network issue or HuggingFace unavailable
- Solution: Check internet connection, try again
- Fallback: Use smaller model (tiny.en)

**Error: "AudioContext is not defined"**
- Cause: Browser doesn't support Web Audio API
- Solution: Update browser, use modern browser
- Note: Only for testing environments

**Error: "Out of memory"**
- Cause: Large audio + large model + low device memory
- Solution: Use smaller model (tiny.en)
- Alternative: Close other browser tabs

**Error: "DOMException: decodeAudioData"**
- Cause: Audio format not supported or corrupted
- Solution: Try re-recording, use different format
- Supported: MP3, WAV, M4A, OGG, FLAC, WebM

### Error Messages to Users

**Generic Error:**
"Transcription failed. Please try again or check your internet connection."

**Model Download Failed:**
"Failed to download the transcription model. Please check your connection and try again."

**Audio Processing Error:**
"Could not process this audio file. Please try a different recording."

**Timeout Error:**
"Transcription is taking longer than expected. Please wait or try again."

---

## Performance Characteristics

### Benchmarks (Modern Hardware)

**First Transcription (with download):**
- tiny.en: 30-60 seconds total
  - Download: 10-20s
  - Processing 10s audio: 15-25s
  
- base.en: 60-120 seconds total
  - Download: 30-60s
  - Processing 10s audio: 20-40s
  
- small.en: 120-180 seconds total
  - Download: 60-120s
  - Processing 10s audio: 40-60s

**Cached Model:**
- tiny.en: 2-5 seconds for 10s audio
- base.en: 5-15 seconds for 10s audio
- small.en: 15-40 seconds for 10s audio

### Factors Affecting Speed
- Audio length (longer = more processing time)
- Device CPU (slower devices = longer times)
- Available RAM (low memory = slower processing)
- Browser (some more optimized than others)
- Model size (larger = more accurate but slower)

### Optimization Tips
1. Use tiny.en for testing
2. Cache model on first use
3. Process shorter audio clips
4. Close other applications
5. Use stable internet for first download

---

## Browser Support

### Required Features
- Web Workers (ES module format)
- Web Audio API
- SharedArrayBuffer support
- WASM support
- IndexedDB (for model caching)

### Tested Browsers
- ✅ Chrome 92+ (recommended)
- ✅ Edge 92+
- ✅ Firefox 95+
- ✅ Safari 15.2+
- ⚠️ Mobile browsers (iOS Safari, Chrome Mobile)

### Limitations
- Some mobile browsers may have memory constraints
- iOS Safari has limited IndexedDB support
- Older browsers may not support SharedArrayBuffer

---

## Testing

### Unit Tests
**File:** `client/src/lib/audio-processing.test.ts`

Test audio processing functions:
- Duration calculation from samples
- Resampling to 16kHz
- Blob conversion

Run tests:
```bash
cd client
bun run test        # Watch mode
bun run test:run    # Single run
bun run test:ui     # UI mode
```

### Manual Testing

See [TESTING_CHECKLIST.md](../TESTING_CHECKLIST.md) for comprehensive manual testing procedures.

**Quick Test:**
1. Start dev server: `bun run dev`
2. Sign in or create account
3. Go to /app/record
4. Record 5-10 seconds of speech
5. Click "Save Recording"
6. Go to recording detail page
7. Click "Start Transcription"
8. Wait for model download (first time)
9. Verify transcription appears

---

## Configuration

### Vite Configuration
**File:** `client/vite.config.ts`

```typescript
server: {
  headers: {
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
  },
},
optimizeDeps: {
  exclude: ['@huggingface/transformers', 'onnxruntime-web'],
},
```

**Purpose:**
- Enable SharedArrayBuffer for Web Workers
- Prevent pre-bundling of transformers (needs to be dynamic)

### Environment Variables
None required - transformers.js handles model URLs automatically

---

## Future Enhancements

**Planned:**
- Multilingual models (non-.en versions)
- Batch transcription queue
- Export transcriptions (TXT, SRT, PDF)
- Transcription editing UI
- Speaker identification
- Language detection UI
- Model cache management UI (view sizes, clear cache)

**Possible:**
- GPU acceleration (WebGPU when available)
- Quantized models (smaller/faster)
- Local Whisper.cpp integration (instead of transformers.js)
- Real-time transcription improvements

---

## Dependencies

### Required Packages
- `@huggingface/transformers@3.8.1` - Whisper model access and inference
- `onnxruntime-web` - ONNX Runtime for WASM (bundled with transformers)

### Type Definitions
- Included with @huggingface/transformers

### No Additional Dependencies Needed
- Uses native Web Audio API
- Uses native Web Workers
- Uses native IndexedDB (via Dexie)

---

## Troubleshooting

### Model Won't Download
1. Check internet connection
2. Check HuggingFace status (huggingface.co)
3. Try smaller model (tiny.en)
4. Clear browser cache and try again

### Transcription Produces Gibberish
1. Check audio quality (background noise?)
2. Ensure clear speech
3. Try recording in quiet environment
4. Use larger model (small.en instead of tiny.en)

### UI Freezes During Transcription
1. This should NOT happen (Web Worker used)
2. Check browser console for errors
3. Restart dev server
4. Clear browser cache

### Out of Memory Errors
1. Close other browser tabs
2. Use smaller model
3. Try shorter audio clips
4. Restart browser

### Model Takes Too Long to Download
1. Check internet speed
2. Try wired connection
3. Can take 5+ minutes on slow connections
4. Only happens once per model

