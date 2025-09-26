// Simple toast system
function showToast({ title, message, actions = [], type = '' }) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="title">${title}</div>
    <div class="message">${message}</div>
    <div class="actions"></div>
  `;
  const actionsEl = el.querySelector('.actions');
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = a.label;
    btn.onclick = () => {
      a.onClick?.();
      if (a.closeOnClick !== false) container.removeChild(el);
    };
    actionsEl.appendChild(btn);
  });
  container.appendChild(el);
  return {
    close: () => container.contains(el) && container.removeChild(el)
  };
}

async function createBooking(payload) {
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Erreur création réservation');
  return res.json();
}

function openBookingToast(id, title, pricePerNight){
  const start = document.getElementById(`start-${id}`).value;
  const end = document.getElementById(`end-${id}`).value;
  const guests = Number(document.getElementById(`guests-${id}`).value || 1);
  const guestName = document.getElementById(`name-${id}`).value;
  const guestEmail = document.getElementById(`email-${id}`).value;

  if (!start || !end || !guestName || !guestEmail) {
    showToast({ title: 'Informations manquantes', message: 'Veuillez remplir les dates, votre nom et votre email', actions: [] });
    return;
  }

  const nights = Math.max(1, Math.ceil((new Date(end) - new Date(start)) / (1000*60*60*24)));
  const total = nights * pricePerNight;
  const msg = `Vous avez décidé de booker le logement "${title}" pour la période du ${start} au ${end}. Montant estimé: ${total} €. Veuillez cliquer sur payer pour générer un lien de paiement Revolut.`;

  const t = showToast({
    title: 'Confirmation de réservation',
    message: msg,
    actions: [
      { label: 'Annuler', onClick: ()=>{}, closeOnClick: true },
      { label: 'Valider la réservation', onClick: async () => {
          try {
            const booking = await createBooking({ propertyId: id, startDate: start, endDate: end, guests, guestName, guestEmail });
            // Notify admin and client via backend (EmailJS server-side)
            fetch('/api/notify/booking', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(booking) }).catch(()=>{});
            showToast({ title: 'Validation réussie', type: 'success', message: 'Vous allez recevoir dans un délai de 24h un lien de paiement Revolut par mail pour confirmer la réservation.' });
          } catch (e) {
            showToast({ title: 'Erreur', message: e.message || 'Impossible de créer la réservation' });
          }
        }
      }
    ]
  });
}

// Delegated click handler for booking buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-book');
  if (!btn) return;
  const id = btn.dataset.id;
  const title = btn.dataset.title;
  const price = Number(btn.dataset.price || 0);
  openBookingToast(id, title, price);
  // Initialize calendars with disabled dates for this property
  setupPropertyCalendars(id);
});

async function setupPropertyCalendars(propertyId){
  try {
    if (!window.AirDatepicker) return; // fallback
    const res = await fetch(`/api/properties/${propertyId}/blocked`);
    const ranges = await res.json();
    // Build a quick checker for blocked dates
    const blocks = (ranges || []).map(r => ({ s: new Date(r.startDate), e: new Date(r.endDate) }));
    const isBlocked = (d) => {
      const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      return blocks.some(b => {
        const bs = new Date(b.s.getFullYear(), b.s.getMonth(), b.s.getDate()).getTime();
        const be = new Date(b.e.getFullYear(), b.e.getMonth(), b.e.getDate()).getTime();
        return t >= bs && t <= be;
      });
    };
    const startEl = document.getElementById(`start-${propertyId}`);
    const endEl = document.getElementById(`end-${propertyId}`);
    if (!startEl || !endEl) return;
    new AirDatepicker(startEl, {
      autoClose: true,
      dateFormat: 'yyyy-MM-dd',
      onRenderCell: ({date}) => ({ disabled: isBlocked(date) })
    });
    new AirDatepicker(endEl, {
      autoClose: true,
      dateFormat: 'yyyy-MM-dd',
      onRenderCell: ({date}) => ({ disabled: isBlocked(date) })
    });
  } catch {}
}
