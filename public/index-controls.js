const form = document.querySelector('[data-controls]');
const list = document.querySelector('[data-list]');
const result = document.querySelector('[data-results]');

if (form && list) {
  const monthFormatter = new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const monthLabel = (month) =>
    month
      ? monthFormatter.format(new Date(`${month}-01T00:00:00Z`))
      : 'No date';

  const addMonthDividers = (items) => {
    let previousMonth;
    for (const item of items) {
      if (item.hidden) continue;
      const month = item.dataset.updated.slice(0, 7);
      if (month === previousMonth) continue;
      const divider = document.createElement('div');
      divider.className = 'month-divider';
      divider.dataset.monthDivider = '';
      divider.textContent = monthLabel(month);
      list.insertBefore(divider, item);
      previousMonth = month;
    }
  };

  const update = () => {
    const data = new FormData(form);
    const search = String(data.get('search') || '').toLowerCase();
    const lang = String(data.get('language') || '');
    const favoritesOnly = data.get('favorites') === 'on';
    const sort = String(data.get('sort'));
    const items = [...list.querySelectorAll('[data-question]')];

    for (const item of items) {
      item.hidden = !(
        (item.dataset.id.includes(search) ||
          item.dataset.title.includes(search)) &&
        (!lang || item.dataset.languages.split(',').includes(lang)) &&
        (!favoritesOnly || item.dataset.favorite === 'true')
      );
    }

    list.querySelectorAll('[data-month-divider]').forEach((divider) => {
      divider.remove();
    });

    items
      .sort((a, b) =>
        sort === 'id-desc'
          ? +b.dataset.id - +a.dataset.id
          : sort === 'updated'
            ? b.dataset.updated.localeCompare(a.dataset.updated)
            : sort === 'title'
              ? a.dataset.title.localeCompare(b.dataset.title)
              : sort === 'revisions'
                ? +b.dataset.revisions - +a.dataset.revisions
                : +a.dataset.id - +b.dataset.id,
      )
      .forEach((item) => list.append(item));

    if (sort === 'updated') addMonthDividers(items);
  };

  form.addEventListener('input', update);
  update();
}
