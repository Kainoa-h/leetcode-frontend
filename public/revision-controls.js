const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function visibleCardCount(track) {
  return window.matchMedia('(min-width: 1100px)').matches &&
    track.children.length > 1
    ? 2
    : 1;
}

function updateCarousel(carousel) {
  const track = carousel.querySelector('.comparison');
  const cards = [...track.querySelectorAll('.revision')];
  const previous = carousel.querySelector('[data-carousel-previous]');
  const next = carousel.querySelector('[data-carousel-next]');
  const status = carousel.querySelector('[data-carousel-status]');
  if (!cards.length) return;
  const step =
    cards[0].getBoundingClientRect().width +
    parseFloat(getComputedStyle(track).gap || '0');
  const index = Math.min(
    cards.length - 1,
    Math.max(0, Math.round(track.scrollLeft / step)),
  );
  const visible = visibleCardCount(track);
  previous.disabled = index === 0;
  next.disabled = index + visible >= cards.length;
  status.textContent = `Showing ${index + 1}–${Math.min(index + visible, cards.length)} of ${cards.length}`;
}

function moveCarousel(button, direction) {
  const carousel = button.closest('[data-carousel]');
  const track = carousel.querySelector('.comparison');
  const card = track.querySelector('.revision');
  if (!card) return;
  const step =
    card.getBoundingClientRect().width +
    parseFloat(getComputedStyle(track).gap || '0');
  track.scrollBy({
    left: direction * step,
    behavior: reducedMotion.matches ? 'auto' : 'smooth',
  });
}

for (const carousel of document.querySelectorAll('[data-carousel]')) {
  const track = carousel.querySelector('.comparison');
  track.addEventListener('scroll', () => updateCarousel(carousel), {
    passive: true,
  });
  updateCarousel(carousel);
}

const primaryMenu = document.querySelector('[data-approach-menu]');
const approachRail = document.querySelector('[data-approach-rail]');
function updateApproachRail() {
  if (primaryMenu && approachRail)
    approachRail.dataset.visible = String(
      primaryMenu.getBoundingClientRect().bottom < 0,
    );
}
window.addEventListener('scroll', updateApproachRail, { passive: true });
window.addEventListener('resize', () => {
  document.querySelectorAll('[data-carousel]').forEach(updateCarousel);
  updateApproachRail();
});
updateApproachRail();

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.matches('[data-carousel-previous]'))
    return moveCarousel(button, -1);
  if (button.matches('[data-carousel-next]')) return moveCarousel(button, 1);
});
