document.querySelectorAll('.password-toggle').forEach((toggle) => {
  const password = document.getElementById(toggle.getAttribute('aria-controls'));
  if (!password) return;

  toggle.addEventListener('click', () => {
    const isVisible = password.type === 'password';
    password.type = isVisible ? 'text' : 'password';
    toggle.textContent = isVisible ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(isVisible));
  });
});
