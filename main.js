(function () {
  var feed = document.querySelector(`[data-log-src]`);

  if (!feed) {
    return;
  }

  var source = feed.getAttribute(`data-log-src`);

  fetch(source, { cache: `no-store` })
    .then(function (response) {
      if (!response.ok) {
        throw new Error(`HTTP ` + response.status);
      }

      return response.text();
    })
    .then(function (markdown) {
      var entries = parseEntries(markdown);

      if (entries.length === 0) {
        feed.innerHTML = `<p class=empty>No log entries found in <code>log.md</code>.</p>`;
        return;
      }

      feed.innerHTML = entries.map(renderEntry).join(``);
    })
    .catch(function () {
      feed.innerHTML = `<p class=error>Could not load <code>log.md</code>. Run a local server instead of opening <code>index.html</code> directly.</p>`;
    });

  function parseEntries(markdown) {
    var normalized = markdown.replaceAll(`\r\n`, `\n`).replaceAll(`\r`, `\n`);
    var lines = normalized.split(`\n`);
    var entries = [];
    var current = null;

    lines.forEach(function (line) {
      if (line.startsWith(`## `)) {
        if (current) {
          entries.push(current);
        }

        current = {
          title: line.slice(3).trim(),
          lines: []
        };

        return;
      }

      if (current) {
        current.lines.push(line);
      }
    });

    if (current) {
      entries.push(current);
    }

    return entries.filter(function (entry) {
      return entry.title || entry.lines.join(``).trim();
    });
  }

  function renderEntry(entry) {
    var date = dateDetails(entry.title);
    var dateTag = date.datetime
      ? `<time datetime=` + quote(date.datetime) + `>` + renderInline(entry.title) + `</time>`
      : `<span>` + renderInline(entry.title) + `</span>`;
    var day = date.day ? ` <span class=dow>` + escapeHtml(date.day) + `</span>` : ``;

    return `<article class=entry>`
      + `<h2 class=entry-date>` + dateTag + day + `</h2>`
      + `<div class=entry-body>` + renderBlocks(entry.lines) + `</div>`
      + `</article>`;
  }

  function renderBlocks(lines) {
    var html = [];
    var paragraph = [];
    var list = [];
    var code = [];
    var inCode = false;
    var fence = String.fromCharCode(96, 96, 96);

    function flushParagraph() {
      if (paragraph.length === 0) {
        return;
      }

      html.push(`<p>` + renderInline(paragraph.join(` `)) + `</p>`);
      paragraph = [];
    }

    function flushList() {
      if (list.length === 0) {
        return;
      }

      html.push(`<ul>` + list.map(function (item) {
        return `<li>` + renderInline(item) + `</li>`;
      }).join(``) + `</ul>`);
      list = [];
    }

    function flushCode() {
      if (code.length === 0) {
        return;
      }

      html.push(`<pre><code>` + escapeHtml(code.join(`\n`)) + `</code></pre>`);
      code = [];
    }

    lines.forEach(function (line) {
      var trimmed = line.trim();

      if (trimmed.startsWith(fence)) {
        if (inCode) {
          flushCode();
          inCode = false;
        } else {
          flushParagraph();
          flushList();
          inCode = true;
        }

        return;
      }

      if (inCode) {
        code.push(line);
        return;
      }

      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }

      if (trimmed.startsWith(`### `)) {
        flushParagraph();
        flushList();
        html.push(`<h3>` + renderInline(trimmed.slice(4).trim()) + `</h3>`);
        return;
      }

      if (trimmed.startsWith(`- `) || trimmed.startsWith(`* `)) {
        flushParagraph();
        list.push(trimmed.slice(2).trim());
        return;
      }

      var image = parseImage(trimmed);
      if (image) {
        flushParagraph();
        flushList();
        html.push(renderImage(image));
        return;
      }

      paragraph.push(trimmed);
    });

    if (inCode) {
      flushCode();
    }

    flushParagraph();
    flushList();

    return html.join(``);
  }

  function parseImage(line) {
    if (!line.startsWith(`![`) || !line.endsWith(`)`)) {
      return null;
    }

    var divider = line.indexOf(`](`);

    if (divider === -1) {
      return null;
    }

    var alt = line.slice(2, divider).trim();
    var src = safeUrl(line.slice(divider + 2, -1).trim(), false);

    if (!src) {
      return null;
    }

    return { alt: alt, src: src };
  }

  function renderImage(image) {
    var caption = image.alt ? `<figcaption>` + renderInline(image.alt) + `</figcaption>` : ``;

    return `<figure>`
      + `<img src=` + quote(image.src) + ` alt=` + quote(image.alt) + ` loading=lazy>`
      + caption
      + `</figure>`;
  }

  function renderInline(text) {
    var html = ``;
    var index = 0;

    while (index < text.length) {
      if (text.startsWith(String.fromCharCode(96), index)) {
        var codeEnd = text.indexOf(String.fromCharCode(96), index + 1);

        if (codeEnd !== -1) {
          html += `<code>` + escapeHtml(text.slice(index + 1, codeEnd)) + `</code>`;
          index = codeEnd + 1;
          continue;
        }
      }

      if (text.startsWith(`**`, index)) {
        var strongEnd = text.indexOf(`**`, index + 2);

        if (strongEnd !== -1) {
          html += `<strong>` + renderInline(text.slice(index + 2, strongEnd)) + `</strong>`;
          index = strongEnd + 2;
          continue;
        }
      }

      if (text.startsWith(`[`, index)) {
        var labelEnd = text.indexOf(`](`, index);

        if (labelEnd !== -1) {
          var urlEnd = text.indexOf(`)`, labelEnd + 2);

          if (urlEnd !== -1) {
            var label = text.slice(index + 1, labelEnd);
            var href = safeUrl(text.slice(labelEnd + 2, urlEnd), true);

            if (href) {
              html += `<a href=` + quote(href) + externalRel(href) + `>` + escapeHtml(label) + `</a>`;
              index = urlEnd + 1;
              continue;
            }
          }
        }
      }

      html += escapeHtml(text.charAt(index));
      index += 1;
    }

    return html;
  }

  function safeUrl(url, allowMail) {
    var trimmed = url.trim();

    if (!trimmed) {
      return ``;
    }

    if (trimmed.startsWith(`#`) || trimmed.startsWith(`/`) || trimmed.startsWith(`./`) || trimmed.startsWith(`../`)) {
      return trimmed;
    }

    try {
      var parsed = new URL(trimmed, window.location.href);

      if (parsed.protocol === `http:` || parsed.protocol === `https:` || (allowMail && parsed.protocol === `mailto:`)) {
        return trimmed;
      }
    } catch (error) {
      return ``;
    }

    return ``;
  }

  function externalRel(href) {
    if (href.startsWith(`http://`) || href.startsWith(`https://`)) {
      return ` rel=` + quote(`noopener noreferrer`);
    }

    return ``;
  }

  function dateDetails(title) {
    var date = parseDate(title);

    if (!date) {
      return { datetime: ``, day: `` };
    }

    return {
      datetime: date.getFullYear() + `-` + pad(date.getMonth() + 1) + `-` + pad(date.getDate()),
      day: new Intl.DateTimeFormat(`en-US`, { weekday: `short` }).format(date)
    };
  }

  function parseDate(value) {
    var trimmed = value.trim();
    var iso = trimmed.split(`-`);
    var months = {
      january: 0,
      jan: 0,
      february: 1,
      feb: 1,
      march: 2,
      mar: 2,
      april: 3,
      apr: 3,
      may: 4,
      june: 5,
      jun: 5,
      july: 6,
      jul: 6,
      august: 7,
      aug: 7,
      september: 8,
      sep: 8,
      october: 9,
      oct: 9,
      november: 10,
      nov: 10,
      december: 11,
      dec: 11
    };
    var words = trimmed.replaceAll(`,`, ``).split(` `).filter(Boolean);
    var date;

    if (iso.length === 3 && iso[0].length === 4) {
      date = new Date(Number(iso[0]), Number(iso[1]) - 1, Number(iso[2]));
    } else if (words.length === 3 && months[words[0].toLowerCase()] !== undefined) {
      date = new Date(Number(words[2]), months[words[0].toLowerCase()], Number(words[1]));
    } else {
      date = new Date(trimmed + ` 00:00:00`);
    }

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function pad(value) {
    return String(value).padStart(2, `0`);
  }

  function quote(value) {
    var mark = String.fromCharCode(34);
    return mark + escapeAttr(value) + mark;
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll(String.fromCharCode(34), `&quot;`);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll(`&`, `&amp;`)
      .replaceAll(`<`, `&lt;`)
      .replaceAll(`>`, `&gt;`);
  }
})();
