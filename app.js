let celebrities = [];
let selectedCelebrity = null;

const grid = document.getElementById('celebrity-grid');
const searchInput = document.getElementById('search');
const modal = document.getElementById('modal');
const closeModalBtn = document.getElementById('close-modal');
const form = document.getElementById('submit-form');
const submitBtn = document.getElementById('submit-btn');
const successMessage = document.getElementById('success-message');
const closeSuccessBtn = document.getElementById('close-success');

// Load celebrities
async function loadCelebrities() {
  try {
    const res = await fetch('/api/celebrities');
    celebrities = await res.json();
    renderGrid(celebrities);
  } catch (err) {
    grid.innerHTML = '<div class="empty">Could not load celebrities. Is the server running?</div>';
  }
}

function renderGrid(list) {
  if (list.length === 0) {
    grid.innerHTML = '<div class="empty">No celebrities match your search.</div>';
    return;
  }

  grid.innerHTML = list.map(c => {
    const hasImage = c.image && c.image.trim() !== '';
    const photoHtml = hasImage
      ? `<div class="card-photo">
           <img src="${c.image}" alt="${c.name}" loading="lazy"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
           <div class="card-emoji fallback" style="display:none">${c.emoji}</div>
         </div>`
      : `<div class="card-emoji">${c.emoji}</div>`;

    return `
      <div class="card" data-id="${c.id}">
        ${photoHtml}
        <div class="card-name">${c.name}</div>
        <div class="card-category">${c.category}</div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      selectedCelebrity = celebrities.find(c => c.id === id);
      openModal();
    });
  });
}

function openModal() {
  if (!selectedCelebrity) return;

  const emojiEl = document.getElementById('modal-emoji');
  const photoEl = document.getElementById('modal-photo');

  if (selectedCelebrity.image) {
    photoEl.src = selectedCelebrity.image;
    photoEl.style.display = 'block';
    photoEl.onerror = () => {
      photoEl.style.display = 'none';
      emojiEl.style.display = 'block';
      emojiEl.textContent = selectedCelebrity.emoji;
    };
    emojiEl.style.display = 'none';
  } else {
    photoEl.style.display = 'none';
    emojiEl.style.display = 'block';
    emojiEl.textContent = selectedCelebrity.emoji;
  }

  document.getElementById('modal-name').textContent = selectedCelebrity.name;
  document.getElementById('modal-category').textContent = selectedCelebrity.category;

  form.classList.remove('hidden');
  successMessage.classList.add('hidden');
  document.getElementById('user-name').value = '';
  document.getElementById('user-message').value = '';
  submitBtn.disabled = false;
  submitBtn.textContent = 'I want to meet them';

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  selectedCelebrity = null;
}

// Search
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase().trim();
  const filtered = celebrities.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.category.toLowerCase().includes(q)
  );
  renderGrid(filtered);
});

// Close modal
closeModalBtn.addEventListener('click', closeModal);
document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
closeSuccessBtn.addEventListener('click', closeModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Submit form
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedCelebrity) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  const payload = {
    celebrityId: selectedCelebrity.id,
    celebrityName: selectedCelebrity.name,
    name: document.getElementById('user-name').value.trim(),
    message: document.getElementById('user-message').value.trim()
  };

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      form.classList.add('hidden');
      successMessage.classList.remove('hidden');
    } else {
      alert(data.error || 'Something went wrong');
      submitBtn.disabled = false;
      submitBtn.textContent = 'I want to meet them';
    }
  } catch (err) {
    alert('Network error. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'I want to meet them';
  }
});

// Init
loadCelebrities();
