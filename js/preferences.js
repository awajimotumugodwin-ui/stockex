(() => {
  const themeKey = 'stockex.theme';
  const logoKey = 'stockex.businessLogo';

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      return;
    }
  }

  function applyTheme(theme) {
    const mode = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = mode;
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.checked = mode === 'dark';
  }

  applyTheme(readStorage(themeKey));

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('change', () => {
      const theme = themeToggle.checked ? 'dark' : 'light';
      applyTheme(theme);
      writeStorage(themeKey, theme);
    });
  }

  const accountButtons = document.querySelectorAll('.account-button');
  if (!accountButtons.length) return;

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.id = 'businessLogoSheet';
  overlay.innerHTML = `
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="businessLogoTitle">
      <div class="sheet__head">
        <strong id="businessLogoTitle">Business image/logo</strong>
        <button type="button" class="sheet__close" data-close-logo-sheet aria-label="Close">&times;</button>
      </div>
      <div class="business-logo-preview"><img alt="Business logo preview"></div>
      <div class="business-logo-actions">
        <button type="button" class="btn btn-secondary" data-upload-logo>Upload image</button>
        <button type="button" class="btn btn-primary" data-capture-logo>Take photo</button>
      </div>
      <button type="button" class="btn btn-ghost business-logo-remove" data-remove-logo>Remove image</button>
      <p class="business-logo-message" role="status" aria-live="polite"></p>
      <input type="file" accept="image/*" data-logo-file hidden>
    </section>`;
  document.body.appendChild(overlay);

  const preview = overlay.querySelector('.business-logo-preview img');
  const removeButton = overlay.querySelector('[data-remove-logo]');
  const message = overlay.querySelector('.business-logo-message');
  const uploadInput = overlay.querySelector('[data-logo-file]');
  const iconMarkup = new Map([...accountButtons].map(button => [button, button.innerHTML]));

  function updateLogo(dataUrl) {
    accountButtons.forEach(button => {
      if (dataUrl) {
        const image = document.createElement('img');
        image.className = 'account-button__image';
        image.src = dataUrl;
        image.alt = 'Business logo';
        button.replaceChildren(image);
        button.setAttribute('aria-label', 'Business image options');
      } else {
        button.innerHTML = iconMarkup.get(button);
        button.setAttribute('aria-label', 'Account');
      }
    });
    preview.src = dataUrl || '';
    preview.hidden = !dataUrl;
    removeButton.hidden = !dataUrl;
  }

  function openSheet() {
    message.textContent = '';
    overlay.classList.add('is-open');
    overlay.querySelector('[data-close-logo-sheet]').focus();
  }

  function closeSheet() {
    overlay.classList.remove('is-open');
    accountButtons[0].focus();
  }

  updateLogo(readStorage(logoKey));
  accountButtons.forEach(button => button.addEventListener('click', openSheet));
  overlay.addEventListener('click', event => {
    if (event.target === overlay || event.target.closest('[data-close-logo-sheet]')) closeSheet();
  });
  overlay.querySelector('[data-upload-logo]').addEventListener('click', () => uploadInput.click());
  overlay.querySelector('[data-capture-logo]').addEventListener('click', () => {
    overlay.classList.remove('is-open');
    accountButtons[0].focus();
    window.StockExCamera.open({ mode: 'photo', onCapture: processLogoImage });
  });
  overlay.querySelector('[data-remove-logo]').addEventListener('click', () => {
    removeStorage(logoKey);
    updateLogo(null);
    message.textContent = 'Business image removed.';
  });

  function processLogoImage(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.textContent = 'Choose an image file.';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 512 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        if (!writeStorage(logoKey, dataUrl)) {
          message.textContent = 'Image could not be saved on this device.';
          return;
        }
        updateLogo(dataUrl);
        message.textContent = 'Business image updated.';
      };
      image.onerror = () => {
        message.textContent = 'This image could not be opened.';
      };
      image.src = reader.result;
    };
    reader.onerror = () => {
      message.textContent = 'This image could not be read.';
    };
    reader.readAsDataURL(file);
  }

  function handleImageFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    processLogoImage(file);
  }

  uploadInput.addEventListener('change', handleImageFile);
})();