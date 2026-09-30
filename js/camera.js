(() => {
  let overlay;
  let video;
  let status;
  let captureButton;
  let fallbackButton;
  let fallbackInput;
  let stream;
  let detector;
  let active = false;
  let onCapture;
  let onBarcode;
  let previousFocus;

  function createCameraSheet() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'sheet-overlay camera-overlay';
    overlay.id = 'cameraCaptureSheet';
    overlay.innerHTML = `
      <section class="sheet camera-sheet" role="dialog" aria-modal="true" aria-labelledby="cameraTitle">
        <div class="sheet__head">
          <strong id="cameraTitle">Camera</strong>
          <button type="button" class="sheet__close" data-camera-close aria-label="Close camera">&times;</button>
        </div>
        <div class="camera-frame"><video autoplay muted playsinline></video></div>
        <p class="camera-status" role="status" aria-live="polite" data-camera-status>Starting camera...</p>
        <div class="camera-actions">
          <button type="button" class="btn btn-secondary" data-camera-fallback hidden>Choose or take a photo</button>
          <button type="button" class="btn btn-primary" data-camera-capture>Capture photo</button>
        </div>
        <input type="file" accept="image/*" capture="environment" data-camera-file hidden>
      </section>`;
    document.body.appendChild(overlay);

    video = overlay.querySelector('video');
    status = overlay.querySelector('[data-camera-status]');
    captureButton = overlay.querySelector('[data-camera-capture]');
    fallbackButton = overlay.querySelector('[data-camera-fallback]');
    fallbackInput = overlay.querySelector('[data-camera-file]');

    overlay.querySelector('[data-camera-close]').addEventListener('click', closeCamera);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeCamera();
    });
    captureButton.addEventListener('click', capturePhoto);
    fallbackButton.addEventListener('click', () => fallbackInput.click());
    fallbackInput.addEventListener('change', () => {
      const file = fallbackInput.files && fallbackInput.files[0];
      fallbackInput.value = '';
      if (!file) return;
      const callback = onCapture;
      closeCamera();
      if (callback) callback(file);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && active) closeCamera();
    });
  }

  function closeCamera() {
    active = false;
    detector = null;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    if (video) video.srcObject = null;
    if (overlay) overlay.classList.remove('is-open');
    const focusTarget = previousFocus;
    previousFocus = null;
    if (focusTarget && focusTarget.isConnected) focusTarget.focus();
  }

  function showCameraError(error) {
    const messages = {
      NotAllowedError: 'Camera permission was denied. Allow camera access in your browser settings.',
      NotFoundError: 'No camera was found on this device.',
      NotReadableError: 'The camera is in use by another app.'
    };
    status.textContent = messages[error.name] || 'Camera could not start. Check permissions and try again.';
    fallbackButton.hidden = typeof onCapture !== 'function';
  }

  async function startBarcodeDetection() {
    if (!('BarcodeDetector' in window)) {
      status.textContent = 'Camera is live. Automatic barcode detection is not supported in this browser; enter the barcode manually.';
      return;
    }

    try {
      detector = new BarcodeDetector();
      status.textContent = 'Point the camera at a barcode.';
      detectBarcode();
    } catch {
      status.textContent = 'Camera is live, but automatic barcode detection is unavailable in this browser.';
    }
  }

  async function detectBarcode() {
    if (!active || !detector || !video.videoWidth) return;
    try {
      const detections = await detector.detect(video);
      if (detections.length) {
        const value = detections[0].rawValue;
        const callback = onBarcode;
        closeCamera();
        if (callback) callback(value);
        return;
      }
    } catch {
      status.textContent = 'Hold the barcode steady in the camera view.';
    }
    if (active) requestAnimationFrame(detectBarcode);
  }

  async function openCamera(options = {}) {
    createCameraSheet();
    closeCamera();
    active = true;
    onCapture = options.onCapture;
    onBarcode = options.onBarcode;
    previousFocus = document.activeElement;
    overlay.classList.add('is-open');
    overlay.querySelector('#cameraTitle').textContent = options.mode === 'scan' ? 'Scan barcode' : 'Take photo';
    captureButton.hidden = options.mode === 'scan';
    fallbackButton.hidden = true;
    status.textContent = 'Starting camera...';
    overlay.querySelector('[data-camera-close]').focus();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraError({ name: 'NotSupportedError' });
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } }
      });
      if (!active) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (options.mode === 'scan') startBarcodeDetection();
      else status.textContent = 'Frame the image, then capture.';
    } catch (error) {
      showCameraError(error);
    }
  }

  function capturePhoto() {
    if (!video.videoWidth || !video.videoHeight) {
      status.textContent = 'Wait for the camera preview, then try again.';
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) {
        status.textContent = 'Photo capture failed. Please try again.';
        return;
      }
      const callback = onCapture;
      closeCamera();
      if (callback) callback(blob);
    }, 'image/jpeg', 0.9);
  }

  window.StockExCamera = { open: openCamera, close: closeCamera };
})();