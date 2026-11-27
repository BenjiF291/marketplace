/* The guide is loaded only when opened; its chapter stays selected until reload. */
(() => {
  let dialog;
  window.PlayerGuide = {
    open() {
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.className = 'player-guide-dialog';
        dialog.setAttribute('aria-label', 'Player guide');
        const header = document.createElement('header');
        const title = document.createElement('h2');
        title.textContent = 'Player guide';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Return to game ×';
        close.autofocus = true;
        close.onclick = () => dialog.close();
        const frame = document.createElement('iframe');
        frame.title = 'Creature Update guide chapters';
        frame.src = 'player-guide.html?v=1';
        // Escape must work even while focus is inside the guide document.
        frame.addEventListener('load', () => {
          frame.contentDocument?.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              dialog.close();
            }
          });
        });
        header.append(title, close);
        dialog.append(header, frame);
        document.body.append(dialog);
      }
      if (!dialog.open) dialog.showModal();
    }
  };
})();
