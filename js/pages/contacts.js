/* Контакты: карта-заглушка, FAQ, форма */
export async function init() {
  document.querySelectorAll('.faq__q').forEach((q) => {
    q.addEventListener('click', () => q.closest('.faq__item').classList.toggle('is-open'));
  });

  const city = document.querySelector('#city-select');
  if (city) city.addEventListener('change', () => {
    const note = document.querySelector('#city-note');
    if (note) note.textContent = `Выбран город: ${city.value}. Демо-режим: подставим склад и срок доставки.`;
  });
}
