document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('connect-button');
  const status = document.getElementById('status');

  if (!(button instanceof HTMLButtonElement) || !(status instanceof HTMLParagraphElement)) {
    return;
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Lecture des cookies Instagram...';
    status.classList.remove('error');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'CONNECT_INSTAGRAM' });
      if (!response?.ok) {
        throw new Error(response?.error || 'Erreur inconnue');
      }

      status.textContent = response.username
        ? `Session envoyée pour @${response.username}.`
        : 'Session envoyée avec succès.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Erreur inconnue';
      status.classList.add('error');
    } finally {
      button.disabled = false;
    }
  });
});
