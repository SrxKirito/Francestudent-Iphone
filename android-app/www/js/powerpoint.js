"use strict";

const POWERPOINT_INSTRUCTION = 'Création PowerPoint. Réponds par une courte introduction puis un seul bloc de code de langage pptx contenant du JSON valide, sans commentaire ni virgule finale. Format : {"filename":"presentation.pptx","title":"Titre de la présentation","subtitle":"Sous-titre facultatif","slides":[{"title":"Titre de la diapositive","bullets":["Premier point","Deuxième point"],"notes":"Notes orales facultatives"}]}. L’application crée le vrai fichier PowerPoint modifiable à partir de ce JSON. Ne fournis ni code Python ou JavaScript, ni base64, ni lien de téléchargement inventé. Crée 1 à 40 diapositives, avec des titres courts, des points précis et concis (3 à 5 par diapositive) et des notes pour les explications longues. Respecte le nombre de diapositives demandé, sans ajouter de couverture : la première diapositive sert d’introduction. Utilise la langue de la demande. Appuie-toi sur le sujet et les documents fournis ; si aucun sujet ni document n’est indiqué, demande le sujet avant de créer le fichier.';

function detectsPowerPointRequest(text) {
  const value = String(text || '');
  return /\b(power\s?point|pptx|diaporama)\b/i.test(value) &&
    /(cr[ée]+|g[ée]n[èe]re|fais|faire|pr[ée]pare|r[ée]alise|produis|make|create|generate|je veux|j.aimerais)/i.test(value);
}

function isPowerPointPrompt(text) {
  return String(text || '').startsWith('Création PowerPoint.');
}

function parsePowerPoint(code) {
  const source = String(code || '').trim();
  if (source.length > 200000) throw new Error('Cette présentation est trop volumineuse.');
  let data;
  try { data = JSON.parse(source); } catch { throw new Error('La présentation est incomplète ou son format est invalide. Demandez de la régénérer.'); }
  if (!data || !Array.isArray(data.slides) || !data.slides.length || data.slides.length > 40) throw new Error('La présentation doit contenir entre 1 et 40 diapositives.');
  const text = (value, max, label) => {
    if (value == null) return '';
    if (typeof value !== 'string' || value.length > max) throw new Error(label + ' invalide ou trop long.');
    return value.trim();
  };
  return {
    title: text(data.title, 180, 'Titre') || 'Présentation',
    subtitle: text(data.subtitle, 350, 'Sous-titre'),
    filename: typeof data.filename === 'string' ? data.filename : '',
    slides: data.slides.map((slide, index) => {
      if (!slide || typeof slide !== 'object') throw new Error('Diapositive invalide.');
      const bullets = slide.bullets ?? (typeof slide.content === 'string' ? slide.content.split('\n').filter(Boolean) : []);
      if (!Array.isArray(bullets) || bullets.length > 40) throw new Error('Liste de points invalide.');
      return {
        title: text(slide.title, 180, 'Titre de diapositive') || 'Diapositive ' + (index + 1),
        bullets: bullets.map(item => text(item, 3000, 'Point')).filter(Boolean),
        notes: text(slide.notes, 15000, 'Notes')
      };
    })
  };
}

function powerPointFileName(code) {
  let name = 'presentation';
  try {
    const data = parsePowerPoint(code);
    name = data.filename || data.title;
  } catch { /* Le téléchargement expliquera le problème de format. */ }
  name = name.replace(/\.pptx$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/^\.+|[. ]+$/g, '').slice(0, 100);
  return (name || 'presentation') + '.pptx';
}

// Paginate dense content rather than dropping points or shrinking to unreadable text.
function powerPointPages(data) {
  const pages = [];
  for (const slide of data.slides) {
    let items = [], lines = 0, part = 0;
    const flush = () => {
      pages.push({ title: slide.title + (part ? ' (suite)' : ''), bullets: items, notes: slide.notes });
      items = []; lines = 0; part++;
    };
    for (const bullet of slide.bullets) {
      // Keep each paragraph at a readable size while retaining every character.
      const segments = bullet.match(/[\s\S]{1,350}(?:\s|$)|[\s\S]{1,350}/g) || [];
      for (const segment of segments) {
        const cost = Math.ceil(segment.length / 70) + 1;
        if (items.length && lines + cost > 11) flush();
        items.push(segment.trim()); lines += cost;
      }
    }
    if (items.length || !part) flush();
  }
  return pages;
}

async function makePowerPoint(code) {
  const data = parsePowerPoint(code);
  const Generator = typeof PptxGenJS === 'function' ? PptxGenJS : window.pptxgen;
  if (typeof Generator !== 'function') throw new Error('Le générateur PowerPoint est indisponible. Relancez l’application.');
  const deck = new Generator();
  deck.layout = 'LAYOUT_WIDE';
  deck.author = 'FranceStudent';
  deck.subject = data.subtitle;
  deck.title = data.title;
  deck.lang = 'fr-FR';
  deck.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'fr-FR' };
  const pages = powerPointPages(data);
  pages.forEach((page, index) => {
    const slide = deck.addSlide();
    slide.background = { color: 'F8FAFC' };
    slide.addShape(deck.ShapeType.rect, { x: 0, y: 0, w: 0.16, h: 7.5, fill: { color: '2563EB' }, line: { transparency: 100 } });
    slide.addText(page.title, { x: .65, y: .48, w: 12, h: 1.05, fontSize: 30, bold: true, color: '0F172A', margin: 0, breakLine: false, fit: 'shrink' });
    if (page.bullets.length) {
      const runs = page.bullets.map(item => ({ text: item, options: { bullet: { indent: 20 }, hanging: 4, breakLine: true } }));
      slide.addText(runs, { x: .75, y: 1.8, w: 11.8, h: 4.75, fontSize: 24, color: '334155', margin: 0, paraSpaceAfter: 14, valign: 'top', fit: 'shrink' });
    } else if (index === 0 && data.subtitle) {
      slide.addText(data.subtitle, { x: .75, y: 2.3, w: 11.8, h: 2, fontSize: 26, color: '475569', margin: 0, fit: 'shrink' });
    }
    slide.addText(data.title, { x: .7, y: 7, w: 10.6, h: .25, fontSize: 10, color: '64748B', margin: 0, fit: 'shrink' });
    slide.addText((index + 1) + ' / ' + pages.length, { x: 11.6, y: 7, w: 1, h: .25, fontSize: 10, align: 'right', color: '64748B', margin: 0 });
    if (page.notes) slide.addNotes(page.notes);
  });
  return new Uint8Array(await deck.write({ outputType: 'arraybuffer', compression: true }));
}
