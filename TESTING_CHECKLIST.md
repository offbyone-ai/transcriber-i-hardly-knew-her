# Testing Checklist for Transcription

## Prerequisites
- Dev server must be restarted after vite.config.ts changes
- Modern browser (Chrome 92+, Firefox 95+, Safari 15.2+)
- Microphone access
- Stable internet connection (for first model download)

## Automated Tests

Run the test suite:
```bash
cd client
bun run test        # Watch mode
bun run test:run    # Single run
bun run test:ui     # UI mode
```

Current tests:
- ✅ `audio-processing.test.ts` - Tests duration calculation and function definitions

## Manual Testing Steps

### Step 1: Restart Dev Server
```bash
# Stop current server (Ctrl+C if running)
bun run dev
```

Wait for:
```
VITE v6.x.x  ready in XXXms

➜  Local:   http://localhost:5173/
```

### Step 2: Navigate to App
1. Open http://localhost:5173
2. Sign up or log in
3. Go to `/app/record`

### Step 3: Create a Test Recording
1. Click "Start Recording" (grant mic permission if asked)
2. Speak clearly for 5-10 seconds:
   - Example: "This is a test recording for the transcription feature. The quick brown fox jumps over the lazy dog."
3. Click "Stop Recording"
4. Enter a title (e.g., "Test Transcription")
5. Select or create a subject
6. Click "Save Recording"

### Step 4: Transcribe the Recording
1. You'll be redirected to the recording detail page
2. Click "Start Transcription"
3. Open browser DevTools console (F12)
4. Monitor the console for logs

### Expected Console Output

**Successful transcription:**
```
Starting transcription with model: base.en
Audio converted, samples: 160000
Loading model: Xenova/whisper-base.en
[transformers] Loading model from HuggingFace...
[transformers] Downloading... (this may take a while on first run)
Model loaded successfully
[transformers] Running inference...
Transcription complete: {text: "This is a test recording...", chunks: [...]}
```

**On the UI:**
- Progress bar shows:
  - "Converting audio format..." (10%)
  - "Loading Whisper model (this may take a while on first run)..." (30%)
  - "Transcribing audio..." (50%)
  - "Formatting results..." (90%)
  - "Transcription complete!" (100%)
- Text appears in transcription section
- Segments with timestamps are displayed

### Step 5: Verify Results

Check that:
- ✅ Transcription text is accurate (some errors are normal)
- ✅ Segments show correct timestamps
- ✅ Language is detected correctly
- ✅ Model name is displayed (e.g., "base.en")
- ✅ No errors in console

### Step 6: Test Subsequent Transcriptions
1. Record another audio file
2. Start transcription again
3. Should be MUCH faster (model is cached)
4. Should take < 10 seconds for 10 seconds of audio

## Common Issues and Solutions

### Issue: "Transcription failed. Please try again."

**Check console for:**

**1. "SharedArrayBuffer is not defined"**
- Solution: Restart dev server
- Verify vite.config.ts has CORS headers
- Check browser compatibility

**2. "Failed to fetch model"**
- Solution: Check internet connection
- Try different model in settings
- Check if HuggingFace is accessible

**3. "AudioContext is not defined"**
- Solution: This should only happen in tests, not browser
- If in browser, check browser compatibility

**4. "Out of memory"**
- Solution: Switch to smaller model (tiny or tiny.en)
- Close other browser tabs
- Restart browser

**5. "DOMException: decodeAudioData"**
- Solution: Audio format issue
- Try recording again
- Check MediaRecorder codec support

### Issue: Progress bar stuck

**If stuck at "Converting audio format...":**
- Audio blob may be corrupt
- Check recording was saved properly
- Try recording again

**If stuck at "Loading Whisper model...":**
- Model download may be slow (up to 5 minutes on slow connection)
- Check browser Network tab for download progress
- Check console for errors

**If stuck at "Transcribing audio...":**
- Normal for long recordings (> 1 minute)
- Wait longer
- If > 2 minutes, refresh page and try again

### Issue: Transcription is gibberish

**Possible causes:**
- Audio quality too low
- Background noise
- Wrong language model
- Recording too quiet

**Solutions:**
- Record in quiet environment
- Speak clearly and loudly
- Use English-only model (.en) for English
- Try base model instead of tiny

## Performance Benchmarks

Expected times on modern hardware:

| Recording Length | First Transcription | Cached Model |
|-----------------|--------------------:|-------------:|
| 10 seconds | ~60-90s | ~5-10s |
| 30 seconds | ~90-120s | ~10-20s |
| 1 minute | ~120-180s | ~20-40s |
| 2 minutes | ~180-300s | ~40-80s |

First transcription includes:
- Model download: 30-90s (base.en = ~142MB)
- Model initialization: 10-20s
- Actual transcription: varies by length

## Test Matrix

Test different scenarios:

| Scenario | Expected Result | Status |
|----------|----------------|--------|
| Short recording (5s) | Quick transcription | ⏳ To test |
| Medium recording (30s) | Accurate transcription | ⏳ To test |
| Long recording (2min) | Complete transcription | ⏳ To test |
| Quiet speech | Some inaccuracies | ⏳ To test |
| Background noise | Some inaccuracies | ⏳ To test |
| Different model (tiny) | Faster, less accurate | ⏳ To test |
| Different model (small) | Slower, more accurate | ⏳ To test |
| Multiple recordings | Fast after first | ⏳ To test |
| Offline (after download) | Should work | ⏳ To test |

## Browser Console Commands

Debug commands to run in console:

```javascript
// Check if transformers loaded
console.log(window.transformers)

// Check localStorage for model cache
console.log(localStorage.length)

// Check IndexedDB for recordings
await db.recordings.toArray()

// Check for transcriptions
await db.transcriptions.toArray()

// Clear model cache (force re-download)
localStorage.clear()

// Get preferred model
localStorage.getItem('whisper-preferred-model')
```

## Reporting Issues

If transcription fails, include:
1. Browser version
2. OS version  
3. Console error messages (full stack trace)
4. Network tab (check model downloads)
5. Recording duration and format
6. Steps to reproduce

## Next Steps After Manual Testing

Once manual testing passes:
1. Add browser-based integration tests (Playwright/Cypress)
2. Add mock tests for transcription pipeline
3. Add performance benchmarks
4. Add error recovery tests
5. Test offline functionality
6. Test on mobile devices
