(() => {
  const panel = document.getElementById('benBalAdmin');
  const form = panel.querySelector('form');
  const fields = panel.querySelector('.ben-bal-admin-fields');
  const submit = form.querySelector('button');
  const status = form.querySelector('[role="status"]');
  let controls = [];
  let busy = false;

  async function request(options) {
    const response = await fetch(API_URL + '/ben-bal/admin/leagues', { ...options, headers: resourceHeaders() });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Could not load league settings.');
    return data;
  }

  function field(container, text, input) {
    const label = document.createElement('label');
    label.append(text, input);
    container.append(label);
  }

  async function load() {
    if (!panel.open || busy) return;
    busy = true;
    submit.disabled = true;
    status.textContent = 'Loading league settings…';
    try {
      const { config, packs, leagues } = await request();
      fields.replaceChildren();
      controls = leagues.map(name => {
        const row = document.createElement('fieldset');
        const heading = document.createElement('legend');
        heading.textContent = name;
        row.append(heading);
        const pack = document.createElement('select');
        pack.add(new Option('No reward pack', ''));
        for (const entry of packs) pack.add(new Option(entry.name, entry.id));
        pack.value = packs.some(entry => entry.id === config[name]?.packId) ? config[name].packId : '';
        const preview = document.createElement('img');
        preview.alt = '';
        pack.onchange = () => {
          const image = packs.find(entry => entry.id === pack.value)?.imageUrl;
          preview.hidden = !image;
          if (image) preview.src = API_URL + image;
        };
        pack.onchange();
        field(row, 'Reward pack', pack);
        row.append(preview);
        const range = ['Minimum Overall', 'Maximum Overall'].map((label, index) => {
          const input = document.createElement('input');
          input.type = 'number';
          input.min = 0;
          input.max = 100;
          input.value = config[name]?.range?.[index ? 'max' : 'min'] ?? '';
          field(row, label, input);
          return input;
        });
        fields.append(row);
        return { name, pack, range };
      });
      status.textContent = '';
      submit.disabled = false;
    } catch (error) {
      status.textContent = error.message;
    } finally { busy = false; }
  }
  panel.addEventListener('toggle', load);
  form.onsubmit = async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    submit.disabled = true;
    try {
      const config = Object.fromEntries(controls.map(({ name, pack, range: [min, max] }) => {
        if (Boolean(min.value) !== Boolean(max.value)) throw Error(name + ': Enter both Overall limits or leave both blank.');
        return [name, { packId: pack.value || null, range: min.value ? { min: min.valueAsNumber, max: max.valueAsNumber } : null }];
      }));
      await request({ method: 'PUT', body: JSON.stringify(config) });
      status.textContent = 'League settings saved.';
    } catch (error) { status.textContent = error.message; }
    finally { busy = submit.disabled = false; }
  };
})();
