const $ = (id) => document.getElementById(id),
  state = { image: '', logo: '', iw: 0, ih: 0, zoom: 100, pos: 50 };
const params = new URLSearchParams(location.search),
  articleId = params.get('articleId'),
  draftKey = articleId ? `graphicDraft:${articleId}` : 'graphicDraft';
function update() {
  const val = (id) => $(id).value;
  $('opacityValue').textContent = `${val('opacity')}%`;
  $('graphicPreview').setAttribute(
    'aria-label',
    [val('headline'), val('subtitle'), val('watermark')].filter(Boolean).join('. '),
  );
  renderPreview();
  try {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        ...state,
        fadeVersion: 2,
        fields: Object.fromEntries(
          [
            'headline',
            'hfont',
            'hsize',
            'hcolor',
            'stroke',
            'subtitle',
            'sfont',
            'ssize',
            'scolor',
            'watermark',
            'opacity',
          ].map((id) => [id, val(id)]),
        ),
      }),
    );
  } catch {}
}
function imageRead(id, key) {
  $(id).onchange = (e) => {
    let f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return alert('กรุณาเลือกไฟล์ภาพ');
    if (f.size > 15 * 1024 * 1024) return alert('ไฟล์ภาพต้องไม่เกิน 15 MB');
    let r = new FileReader();
    r.onload = () => {
      let im = new Image();
      im.onload = () => {
        if (key === 'image') {
          state.iw = im.width;
          state.ih = im.height;
        }
        let c = document.createElement('canvas');
        c.width = im.naturalWidth;
        c.height = im.naturalHeight;
        c.getContext('2d').drawImage(im, 0, 0);
        state[key] = c.toDataURL('image/png');
        update();
      };
      im.onerror = () => alert('เปิดไฟล์ภาพนี้ไม่ได้');
      im.src = r.result;
    };
    r.readAsDataURL(f);
  };
}
imageRead('image', 'image');
imageRead('logo', 'logo');
for (let id of [
  'headline',
  'hfont',
  'hsize',
  'hcolor',
  'stroke',
  'subtitle',
  'sfont',
  'ssize',
  'scolor',
  'watermark',
  'opacity',
])
  $(id).addEventListener('input', update);
$('zoom').oninput = (e) => {
  state.zoom = Number(e.target.value);
  update();
};
$('position').oninput = (e) => {
  state.pos = Number(e.target.value);
  update();
};
$('clear').onclick = () => {
  state.image = '';
  state.logo = '';
  $('image').value = '';
  $('logo').value = '';
  update();
};
const measureContext = document.createElement('canvas').getContext('2d');
function wrappedLines(text, font, maxWidth) {
  const paragraphs = String(text).split('\n'),
    lines = [];
  measureContext.font = font;
  const segmenter =
    typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  for (const paragraph of paragraphs) {
    const parts = segmenter
      ? Array.from(segmenter.segment(paragraph), (part) => part.segment)
      : paragraph.split(/(\s+)/).filter(Boolean);
    let line = '';
    for (const part of parts) {
      if (!line && /^\s+$/.test(part)) continue;
      const candidate = line + part;
      if (line && measureContext.measureText(candidate).width > maxWidth) {
        lines.push(line.trimEnd());
        line = part.trimStart();
      } else {
        line = candidate;
      }
    }
    if (line || !parts.length) lines.push(line.trimEnd());
  }
  return lines.length ? lines : [''];
}
function loadGraphicImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
async function drawGraphicCanvas() {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 940;
  canvas.height = 788;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#353348';
  ctx.fillRect(0, 0, 940, 788);

  if (state.image) {
    const photo = await loadGraphicImage(state.image);
    const width = (940 * Number($('zoom').value)) / 100;
    const height = (width * photo.naturalHeight) / photo.naturalWidth;
    const x = (940 - width) / 2;
    const y = ((520 - height) * Number($('position').value)) / 100;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 940, 520);
    ctx.clip();
    ctx.drawImage(photo, x, y, width, height);
    ctx.restore();
  }

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  const cornerLeft = 940 * 0.022;
  const cornerTop = 788 * 0.025;
  ctx.moveTo(cornerLeft, cornerTop + 788 * 0.2);
  ctx.lineTo(cornerLeft, cornerTop);
  ctx.lineTo(cornerLeft + 940 * 0.16, cornerTop);
  ctx.stroke();

  if (state.logo) {
    const logo = await loadGraphicImage(state.logo);
    const box = { x: 940 * (1 - 0.025 - 0.085), y: 788 * 0.025, w: 940 * 0.085, h: 940 * 0.085 };
    ctx.fillStyle = 'rgba(255,255,255,.87)';
    ctx.beginPath();
    ctx.arc(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, 0, Math.PI * 2);
    ctx.fill();
    const scale = Math.min(box.w / logo.naturalWidth, box.h / logo.naturalHeight);
    const w = logo.naturalWidth * scale,
      h = logo.naturalHeight * scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
    ctx.restore();
  }

  const opacity = Number($('opacity').value) / 100;
  ctx.fillStyle = `rgba(255,255,255,${opacity})`;
  ctx.fillRect(0, 520, 940, 268);

  const headlineSize = Number($('hsize').value);
  const subtitleSize = Number($('ssize').value);
  const headlineFont = `700 ${headlineSize}px "${$('hfont').value}", sans-serif`;
  const subtitleFont = `500 ${subtitleSize}px "${$('sfont').value}", sans-serif`;
  const maxTextWidth = 864;
  const headlineLines = wrappedLines($('headline').value, headlineFont, maxTextWidth);
  const subtitleLines = wrappedLines($('subtitle').value, subtitleFont, maxTextWidth);
  const headlineLineHeight = headlineSize * 1.12;
  const subtitleLineHeight = subtitleSize * 1.4;
  const gap = 11.28;
  const contentTop = 520 + 18.8;
  const contentHeight = 268 - 37.6;
  const groupHeight =
    headlineLines.length * headlineLineHeight + gap + subtitleLines.length * subtitleLineHeight;
  const groupTop = contentTop + (contentHeight - groupHeight) / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = headlineFont;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = $('stroke').value;
  ctx.fillStyle = $('hcolor').value;
  ctx.shadowColor = $('stroke').value;
  ctx.shadowBlur = 1;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;
  headlineLines.forEach((line, index) => {
    const y = groupTop - 20.68 + headlineLineHeight * (index + 0.5);
    ctx.strokeText(line, 470, y, maxTextWidth);
    ctx.fillText(line, 470, y, maxTextWidth);
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = subtitleFont;
  ctx.fillStyle = $('scolor').value;
  subtitleLines.forEach((line, index) => {
    const y =
      groupTop +
      headlineLines.length * headlineLineHeight +
      gap +
      subtitleLineHeight * (index + 0.5);
    ctx.fillText(line, 470, y, maxTextWidth);
  });

  ctx.font = '500 13.63px "Prompt", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#9291a9';
  ctx.fillText($('watermark').value, 940 * (1 - 0.025), 773);
  ctx.fillStyle = '#7654e8';
  ctx.fillRect(0, 780, 940, 8);
  return canvas;
}
let previewRenderId = 0;
function renderPreview() {
  const renderId = ++previewRenderId;
  drawGraphicCanvas()
    .then((rendered) => {
      if (renderId !== previewRenderId) return;
      const preview = $('graphicPreview');
      const context = preview.getContext('2d');
      context.clearRect(0, 0, 940, 788);
      context.drawImage(rendered, 0, 0);
    })
    .catch((error) => console.error('Preview render failed', error));
}
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c],
  );
function svgSource() {
  let ph = 520,
    capH = 268,
    hl = $('headline').value.split('\n').length,
    sl = $('subtitle').value.split('\n').length,
    hs = +$('hsize').value,
    ss = +$('ssize').value,
    hy = ph + (capH - (hl * hs * 1.18 + sl * ss * 1.4 + 12)) / 2 + hs / 2,
    sy = hy + hl * hs * 1.18 + 8 + ss / 2;
  const tx = (t, y, z, font, color, stroke = '') =>
    t
      .split('\n')
      .map(
        (l, i) =>
          `<text
            x="470"
            y="${y + i * z * 1.18}"
            text-anchor="middle"
            dominant-baseline="middle"
            font-family="${font}, sans-serif"
            font-size="${z}"
            font-weight="700"
            fill="${color}"
            ${stroke ? `stroke="${stroke}" stroke-width="2.2" paint-order="stroke" stroke-linejoin="round"` : ''}
          >${esc(l)}</text>`,
      )
      .join('');
  let iw = (940 * Number($('zoom').value)) / 100,
    ih = state.iw ? (iw * state.ih) / state.iw : 520,
    ix = (940 - iw) / 2,
    iy = ((520 - ih) * Number($('position').value)) / 100;
  let image = state.image
    ? `<defs>
        <clipPath id="photoClip">
          <rect width="940" height="520" />
        </clipPath>
      </defs>
      <g clip-path="url(#photoClip)">
        <image
          href="${state.image}"
          x="${ix}"
          y="${iy}"
          width="${iw}"
          height="${ih}"
          preserveAspectRatio="none"
        />
      </g>`
    : '<rect width="940" height="520" fill="#353348"/>';
  return `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="940"
    height="788"
    viewBox="0 0 940 788"
  >
    ${image}
    <path d="M20 170V20h150" fill="none" stroke="white" stroke-width="4" />
    ${state.logo ? `<image href="${state.logo}" x="840" y="20" width="80" height="80" preserveAspectRatio="xMidYMid meet" />` : ''}
    <rect y="520" width="940" height="268" fill="#fff" fill-opacity="${$('opacity').value / 100}" />
    ${tx($('headline').value, hy - 20, hs, $('hfont').value, $('hcolor').value, $('stroke').value)}
    ${tx($('subtitle').value, sy, ss, $('sfont').value, $('scolor').value)}
    <text x="916" y="770" text-anchor="end" font-family="Prompt, sans-serif" font-size="14" fill="#9291a9">${esc($('watermark').value)}</text>
    <rect y="780" width="940" height="8" fill="#7654e8" />
  </svg>`;
}
function download(blob, name) {
  let a = document.createElement('a'),
    u = URL.createObjectURL(blob);
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
}
$('svg').onclick = () =>
  download(new Blob([svgSource()], { type: 'image/svg+xml' }), 'gaming-news-graphic.svg');
$('png').onclick = async () => {
  try {
    const canvas = await drawGraphicCanvas();
    canvas.toBlob((blob) => {
      if (!blob) return alert('ส่งออก PNG ไม่สำเร็จ');
      download(blob, 'gaming-news-graphic.png');
    }, 'image/png');
  } catch (error) {
    console.error(error);
    alert('ส่งออก PNG ไม่สำเร็จ');
  }
};
// A small store-only ZIP writer keeps this single-slide PowerPoint export dependency-free.
const utf = (s) => new TextEncoder().encode(s),
  u16 = (n) => [n & 255, (n >>> 8) & 255],
  u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
function crc32(a) {
  let c = ~0;
  for (const b of a) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
  }
  return ~c >>> 0;
}
function makeZip(files) {
  let locals = [],
    central = [],
    offset = 0;
  for (const [name, content] of Object.entries(files)) {
    let n = utf(name),
      d = typeof content === 'string' ? utf(content) : content,
      crc = crc32(d),
      lh = new Uint8Array([
        ...u32(0x04034b50),
        ...u16(20),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(crc),
        ...u32(d.length),
        ...u32(d.length),
        ...u16(n.length),
        ...u16(0),
        ...n,
        ...d,
      ]);
    locals.push(lh);
    let ch = new Uint8Array([
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(d.length),
      ...u32(d.length),
      ...u16(n.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...n,
    ]);
    central.push(ch);
    offset += lh.length;
  }
  let cd = central.reduce((n, b) => n + b.length, 0),
    end = new Uint8Array([
      ...u32(0x06054b50),
      ...u16(0),
      ...u16(0),
      ...u16(files.length),
      ...u16(files.length),
      ...u32(cd),
      ...u32(offset),
      ...u16(0),
    ]);
  return new Blob([...locals, ...central, end], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}
const emu = (px) => Math.round((px * 914400) / 940),
  col = (s) => s.replace('#', '').toUpperCase();
function solid(c, alpha = 100000) {
  return `<a:solidFill><a:srgbClr val="${col(c)}">${alpha < 100000 ? `<a:alpha val="${alpha}"/>` : ''}</a:srgbClr></a:solidFill>`;
}
function shape(id, name, x, y, w, h, fill, text = '', style = {}) {
  let tx = text
    ? '<p:txBody><a:bodyPr wrap="square" anchor="ctr"/><a:lstStyle/>' +
      text
        .split('\n')
        .map(
          (line) =>
            '<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="th-TH" sz="' +
            Math.round((style.size || 22) * 75) +
            '" b="' +
            (style.bold ? '1' : '0') +
            '">' +
            solid(style.color || '#ffffff') +
            (style.stroke ? '<a:ln w="15240">' + solid(style.stroke) + '</a:ln>' : '') +
            '<a:latin typeface="' +
            esc(style.font || 'Arial') +
            '"/><a:ea typeface="' +
            esc(style.font || 'Arial') +
            '"/></a:rPr><a:t>' +
            esc(line) +
            '</a:t></a:r><a:endParaRPr lang="th-TH"/></a:p>',
        )
        .join('') +
      '</p:txBody>'
    : '';
  let fillXml = fill
    ? fill.startsWith('<a:gradFill')
      ? fill
      : fill.startsWith('<a:srgbClr')
        ? '<a:solidFill>' + fill + '</a:solidFill>'
        : '<a:solidFill><a:srgbClr val="' + col(fill) + '"/></a:solidFill>'
    : '<a:noFill/>';
  return (
    '<p:sp><p:nvSpPr><p:cNvPr id="' +
    id +
    '" name="' +
    esc(name) +
    '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' +
    emu(x) +
    '" y="' +
    emu(y) +
    '"/><a:ext cx="' +
    emu(w) +
    '" cy="' +
    emu(h) +
    '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
    fillXml +
    '<a:ln><a:noFill/></a:ln>' +
    '</p:spPr>' +
    tx +
    '</p:sp>'
  );
}
function pic(id, name, rel, x, y, w, h, crop) {
  return `<p:pic>
    <p:nvPicPr>
      <p:cNvPr id="${id}" name="${name}" />
      <p:cNvPicPr><a:picLocks noChangeAspect="1" /></p:cNvPicPr>
      <p:nvPr />
    </p:nvPicPr>
    <p:blipFill>
      <a:blip r:embed="${rel}" />
      ${crop ? `<a:srcRect l="${crop.l}" r="${crop.r}" t="${crop.t}" b="${crop.b}" />` : ''}
      <a:stretch><a:fillRect /></a:stretch>
    </p:blipFill>
    <p:spPr>
      <a:xfrm>
        <a:off x="${emu(x)}" y="${emu(y)}" />
        <a:ext cx="${emu(w)}" cy="${emu(h)}" />
      </a:xfrm>
      <a:prstGeom prst="rect"><a:avLst /></a:prstGeom>
    </p:spPr>
  </p:pic>`;
}
function dataBytes(data) {
  let b = atob(data.split(',')[1]),
    a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}
function cropCalc() {
  let ar = state.iw / state.ih,
    target = 940 / 520,
    z = Number($('zoom').value) / 100,
    pos = Number($('position').value) / 100,
    l = 0,
    r = 0,
    t = 0,
    b = 0;
  if (ar > target) {
    let visible = target / ar / z;
    visible = Math.min(1, visible);
    l = Math.round((1 - visible) * 50000);
    r = l;
  } else {
    let visible = ar / target / z;
    visible = Math.min(1, visible);
    t = Math.round((1 - visible) * pos * 100000);
    b = Math.round((1 - visible) * (1 - pos) * 100000);
  }
  return { l, r, t, b };
}
$('pptx').onclick = async () => {
  try {
    const PptxGen = window.PptxGenJS;
    if (!PptxGen) throw new Error('PPTX library did not load');
    await document.fonts.ready;
    const pptx = new PptxGen();
    pptx.defineLayout({ name: 'GAMING_GRAPHIC', width: 9.4, height: 7.88 });
    pptx.layout = 'GAMING_GRAPHIC';
    pptx.author = 'Gaming News Studio';
    pptx.subject = 'Editable gaming news graphic';
    pptx.title = $('headline').value || 'Gaming news graphic';
    pptx.company = 'Gaming News Studio';
    pptx.lang = 'th-TH';
    pptx.theme = { headFontFace: $('hfont').value, bodyFontFace: $('sfont').value, lang: 'th-TH' };
    const slide = pptx.addSlide();
    slide.background = { color: '353348' };

    const photoCanvas = document.createElement('canvas');
    photoCanvas.width = 940;
    photoCanvas.height = 520;
    const pctx = photoCanvas.getContext('2d');
    pctx.fillStyle = '#343246';
    pctx.fillRect(0, 0, 940, 520);
    if (state.image) {
      const photo = await loadGraphicImage(state.image);
      const width = (940 * Number($('zoom').value)) / 100;
      const height = (width * photo.naturalHeight) / photo.naturalWidth;
      const x = (940 - width) / 2;
      const y = ((520 - height) * Number($('position').value)) / 100;
      pctx.save();
      pctx.beginPath();
      pctx.rect(0, 0, 940, 520);
      pctx.clip();
      pctx.drawImage(photo, x, y, width, height);
      pctx.restore();
    }
    slide.addImage({ data: photoCanvas.toDataURL('image/png'), x: 0, y: 0, w: 9.4, h: 5.2 });

    slide.addShape(pptx.ShapeType.line, {
      x: 0.2,
      y: 0.2,
      w: 1.5,
      h: 0,
      line: { color: 'FFFFFF', width: 3 },
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.2,
      y: 0.2,
      w: 0,
      h: 1.5,
      line: { color: 'FFFFFF', width: 3 },
    });

    if (state.logo) {
      const logo = await loadGraphicImage(state.logo);
      slide.addShape(pptx.ShapeType.ellipse, {
        x: 8.4,
        y: 0.2,
        w: 0.8,
        h: 0.8,
        fill: { color: 'FFFFFF', transparency: 13 },
        line: { color: 'FFFFFF', transparency: 100 },
      });
      const maxW = 0.72,
        maxH = 0.72;
      const scale = Math.min(maxW / (logo.naturalWidth / 100), maxH / (logo.naturalHeight / 100));
      const w = (logo.naturalWidth / 100) * scale,
        h = (logo.naturalHeight / 100) * scale;
      slide.addImage({ data: state.logo, x: 8.8 - w / 2, y: 0.6 - h / 2, w, h });
    }

    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 5.2,
      w: 9.4,
      h: 2.68,
      fill: { color: 'FFFFFF', transparency: 100 - Number($('opacity').value) },
      line: { color: 'FFFFFF', transparency: 100 },
    });

    const headlineSize = Number($('hsize').value),
      subtitleSize = Number($('ssize').value);
    const headlineFont = `700 ${headlineSize}px "${$('hfont').value}", sans-serif`;
    const subtitleFont = `500 ${subtitleSize}px "${$('sfont').value}", sans-serif`;
    const maxTextWidth = 864;
    const headlineLines = wrappedLines($('headline').value, headlineFont, maxTextWidth);
    const subtitleLines = wrappedLines($('subtitle').value, subtitleFont, maxTextWidth);
    const hLine = headlineSize * 1.12,
      sLine = subtitleSize * 1.4,
      gap = 11.28;
    const contentTop = 520 + 18.8,
      contentHeight = 268 - 37.6;
    const groupHeight = headlineLines.length * hLine + gap + subtitleLines.length * sLine;
    const groupTop = contentTop + (contentHeight - groupHeight) / 2;
    slide.addText(headlineLines.join('\n'), {
      x: 0.38,
      y: (groupTop - 20.68) / 100,
      w: 8.64,
      h: (headlineLines.length * hLine) / 100,
      fontFace: $('hfont').value,
      fontSize: headlineSize * 0.75,
      bold: true,
      color: $('hcolor').value.replace('#', ''),
      outline: { color: $('stroke').value.replace('#', ''), size: 0.9 },
      align: 'center',
      valign: 'mid',
      margin: 0,
      breakLine: false,
      fit: 'shrink',
      paraSpaceAfterPt: 0,
    });
    slide.addText(subtitleLines.join('\n'), {
      x: 0.38,
      y: (groupTop + headlineLines.length * hLine + gap) / 100,
      w: 8.64,
      h: (subtitleLines.length * sLine) / 100,
      fontFace: $('sfont').value,
      fontSize: subtitleSize * 0.75,
      bold: false,
      color: $('scolor').value.replace('#', ''),
      align: 'center',
      valign: 'mid',
      margin: 0,
      fit: 'shrink',
      paraSpaceAfterPt: 0,
    });
    slide.addText($('watermark').value, {
      x: 7.4,
      y: 7.52,
      w: 1.76,
      h: 0.22,
      fontFace: 'Prompt',
      fontSize: 10.5,
      color: '9291A9',
      align: 'right',
      valign: 'mid',
      margin: 0,
      fit: 'shrink',
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 7.8,
      w: 9.4,
      h: 0.08,
      fill: { color: '7654E8' },
      line: { color: '7654E8', transparency: 100 },
    });
    await pptx.writeFile({ fileName: 'gaming-news-graphic.pptx' });
  } catch (e) {
    console.error(e);
    alert('ส่งออก PPTX ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
  }
};
try {
  let d = JSON.parse(localStorage.getItem(draftKey) || 'null');
  if (d) {
    if (!d.fadeVersion && d.fields?.opacity === '88') {
      d.fields.opacity = '100';
      d.fadeVersion = 2;
      localStorage.setItem(draftKey, JSON.stringify(d));
    }
    Object.assign(state, d);
    for (let [k, v] of Object.entries(d.fields || {})) if ($(k)) $(k).value = v;
    if (state.image) {
      let im = new Image();
      im.onload = () => {
        state.iw = im.width;
        state.ih = im.height;
        update();
      };
      im.src = state.image;
    }
  } else {
    const headline = params.get('headline'),
      subtitle = params.get('subtitle');
    if (headline !== null) $('headline').value = headline;
    if (subtitle !== null) $('subtitle').value = subtitle;
  }
} catch {}
update();
