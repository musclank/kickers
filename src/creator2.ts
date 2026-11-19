type FieldValue = string;
const creator = document.querySelector<HTMLElement>('#creator');
if (creator && !document.querySelector('#creator2-tools')) {
  const quickBuild = document.createElement('section');
  quickBuild.id = 'creator2-tools';
  quickBuild.className = 'creator2-tools';
  quickBuild.innerHTML = `
    <div class="creator2-heading"><div><span class="eyebrow">CREATOR 2.0</span><strong>QUICK BUILD</strong></div><span class="creator2-note">BUILD · SAVE · REUSE</span></div>
    <div class="creator2-presets" aria-label="Body shape presets">
      <button type="button" data-shape="balanced"><strong>BALANCED</strong><small>All-rounder</small></button>
      <button type="button" data-shape="heavy"><strong>HEAVY</strong><small>Wide & powerful</small></button>
      <button type="button" data-shape="agile"><strong>AGILE</strong><small>Lean & fast look</small></button>
      <button type="button" data-shape="hero"><strong>HERO</strong><small>Tall silhouette</small></button>
    </div>
    <div class="creator2-actions">
      <button type="button" data-action="random">RANDOMIZE LOOK</button>
      <button type="button" data-action="reset">RESET DESIGN</button>
    </div>
    <div class="creator2-heading creator2-slots-heading"><div><span class="eyebrow">DESIGN VAULT</span><strong>MY CHARACTER SLOTS</strong></div><span class="creator2-note">3 LOCAL SLOTS</span></div>
    <div class="creator2-slots">
      <div class="creator2-slot" data-slot="1"><div><strong>SLOT 01</strong><small>Empty slot</small></div><button type="button" data-slot-save="1">SAVE</button><button type="button" data-slot-load="1" disabled>LOAD</button></div>
      <div class="creator2-slot" data-slot="2"><div><strong>SLOT 02</strong><small>Empty slot</small></div><button type="button" data-slot-save="2">SAVE</button><button type="button" data-slot-load="2" disabled>LOAD</button></div>
      <div class="creator2-slot" data-slot="3"><div><strong>SLOT 03</strong><small>Empty slot</small></div><button type="button" data-slot-save="3">SAVE</button><button type="button" data-slot-load="3" disabled>LOAD</button></div>
    </div>
    <p class="creator2-status" id="creator2-status" aria-live="polite">Quick builds update the live fighter preview. Save your final design below.</p>
  `;
  const heading = creator.querySelector('.creator-heading');
  heading?.insertAdjacentElement('afterend', quickBuild);

  const fields = ['character-type','skin-color','outfit-color','pants-color','shoe-color','glove-color','hair-color','eye-color','top-style','pants-style','shoe-style','head-type','hair-style','accessory','eye-style','body-width','body-height','head-size','leg-length'];
  const status = quickBuild.querySelector<HTMLElement>('#creator2-status')!;
  const say = (message: string) => { status.textContent = message; };
  const setField = (id: string, value: string) => {
    const element = creator.querySelector<HTMLInputElement | HTMLSelectElement>('#' + id);
    if (!element) return;
    element.value = value;
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  };
  const readDesign = (): Record<string, FieldValue> => {
    const design: Record<string, FieldValue> = {};
    fields.forEach(id => {
      const element = creator.querySelector<HTMLInputElement | HTMLSelectElement>('#' + id);
      if (element) design[id] = element.value;
    });
    return design;
  };
  const updateSlots = () => {
    [1,2,3].forEach(slot => {
      const saved = localStorage.getItem('kickers-creator2-slot-' + slot);
      const row = quickBuild.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
      const description = row.querySelector('small')!;
      const load = row.querySelector<HTMLButtonElement>('[data-slot-load]')!;
      load.disabled = !saved;
      if (!saved) description.textContent = 'Empty slot';
      else {
        try {
          const data = JSON.parse(saved) as Record<string,string>;
          description.textContent = (data['head-type'] || 'Human') + ' · ' + (data['top-style'] || 'Tee');
        } catch { description.textContent = 'Saved design'; }
      }
    });
  };
  quickBuild.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach(button => {
    button.addEventListener('click', () => {
      const shapes: Record<string, Record<string,string>> = {
        balanced: {'body-width':'1.0','body-height':'1.0','head-size':'1.0','leg-length':'1.0'},
        heavy: {'body-width':'1.5','body-height':'1.2','head-size':'0.9','leg-length':'0.8'},
        agile: {'body-width':'0.8','body-height':'0.9','head-size':'0.9','leg-length':'1.5'},
        hero: {'body-width':'1.1','body-height':'1.5','head-size':'1.1','leg-length':'1.4'}
      };
      Object.entries(shapes[button.dataset.shape || 'balanced']).forEach(([id,value]) => setField(id,value));
      quickBuild.querySelectorAll('[data-shape]').forEach(item => item.classList.toggle('selected', item === button));
      say(button.dataset.shape!.toUpperCase() + ' BODY PROFILE APPLIED');
    });
  });
  quickBuild.querySelector('[data-action="random"]')?.addEventListener('click', () => {
    const pick = <T,>(values: T[]) => values[Math.floor(Math.random() * values.length)];
    const colors = ['#4de2d0','#ffb84d','#ff6685','#8b7cff','#62a8ff','#78d66b','#f2f4f8','#27324d','#d36a35'];
    const heads = ['human','wolf','fox','bear','bull','shark','skull','alien'];
    const tops = ['tee','jacket','hoodie','armor'];
    const pants = ['shorts','long','joggers'];
    const shoes = ['sneakers','high-tops','boots','futuristic'];
    const hairs = ['none','smooth','spiky','cap'];
    const accessories = ['none','glasses','crown','horns'];
    const eyes = ['round','wide','slit','angry'];
    [['skin-color',pick(colors)],['outfit-color',pick(colors)],['pants-color',pick(colors)],['shoe-color',pick(colors)],['glove-color',pick(colors)],['hair-color',pick(colors)],['eye-color',pick(colors)],['head-type',pick(heads)],['top-style',pick(tops)],['pants-style',pick(pants)],['shoe-style',pick(shoes)],['hair-style',pick(hairs)],['accessory',pick(accessories)],['eye-style',pick(eyes)]].forEach(([id,value]) => setField(String(id),String(value)));
    say('RANDOM LOOK GENERATED — TWEAK IT OR SAVE TO A SLOT');
  });
  quickBuild.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
    const defaults: Record<string,string> = {'character-type':'human','skin-color':'#4de2d0','outfit-color':'#ffb84d','pants-color':'#33415f','shoe-color':'#24243a','glove-color':'#e8edf5','hair-color':'#26314d','eye-color':'#172033','top-style':'tee','pants-style':'long','shoe-style':'sneakers','head-type':'human','hair-style':'smooth','accessory':'none','eye-style':'round','body-width':'1','body-height':'1','head-size':'1','leg-length':'1'};
    Object.entries(defaults).forEach(([id,value]) => setField(id,value));
    quickBuild.querySelectorAll('[data-shape]').forEach(item => item.classList.remove('selected'));
    say('DEFAULT DESIGN RESTORED — SAVE TO KEEP IT');
  });
  quickBuild.querySelectorAll<HTMLButtonElement>('[data-slot-save]').forEach(button => {
    button.addEventListener('click', () => {
      const slot = button.dataset.slotSave!;
      try {
        localStorage.setItem('kickers-creator2-slot-' + slot, JSON.stringify(readDesign()));
        updateSlots();
        say('DESIGN SAVED TO SLOT ' + slot);
      } catch { say('COULD NOT SAVE THIS SLOT ON YOUR DEVICE'); }
    });
  });
  quickBuild.querySelectorAll<HTMLButtonElement>('[data-slot-load]').forEach(button => {
    button.addEventListener('click', () => {
      const slot = button.dataset.slotLoad!;
      try {
        const saved = localStorage.getItem('kickers-creator2-slot-' + slot);
        if (!saved) return;
        const design = JSON.parse(saved) as Record<string,string>;
        Object.entries(design).forEach(([id,value]) => setField(id,value));
        quickBuild.querySelectorAll('[data-shape]').forEach(item => item.classList.remove('selected'));
        say('SLOT ' + slot + ' LOADED — SAVE CHARACTER TO APPLY PERMANENTLY');
      } catch { say('THIS SLOT COULD NOT BE LOADED'); }
    });
  });
  updateSlots();
}
