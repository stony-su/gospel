"""Read recipes, descriptions and photographs off Wikimedia's own pages.

Three things get pulled, from three places:

  Wikibooks Cookbook   the ingredient list and the method, where a page for
                       the dish exists. CC BY-SA 4.0.
  Wikipedia            one sentence of description, and the lead photograph.
                       CC BY-SA 4.0.
  Wikimedia Commons    that photograph's author and licence, which the app is
                       obliged to display and does.

Everything is fetched as ordinary HTML from the public site - no API, no
dataset dump - and cached to disk, so a re-run costs nothing and an
interrupted run resumes. Requests are serialised behind a shared throttle and
identify themselves; Wikimedia returns 429 to anything that does not, and
being polite is cheaper than being retried.

Only images hosted on Commons are accepted. Files that live on the English
Wikipedia itself are usually non-free fair-use uploads, and a fair-use claim
that covers an encyclopaedia article does not travel to a meal planner.
"""

from __future__ import annotations

import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache" / "wikimedia"

UA = ("GospelRecipeBuild/1.0 (https://github.com/stony-su/gospel; "
      "taixue@gmail.com) python-urllib")

# Wikimedia asks unregistered clients to keep it to a few requests a second and
# answers 429 when they do not. One request at a time with a gap is slower than
# it needs to be and never gets throttled.
_GATE = threading.Semaphore(1)
_LAST = [0.0]
MIN_GAP = 0.5

WIKIBOOKS = "https://en.wikibooks.org/wiki/Cookbook:"
WIKIPEDIA = "https://en.wikipedia.org/wiki/"
COMMONS_FILE = "https://commons.wikimedia.org/wiki/File:"


def fetch(url: str) -> str | None:
    """Cached GET. None means the page does not exist."""
    CACHE.mkdir(parents=True, exist_ok=True)
    key = CACHE / (re.sub(r"[^A-Za-z0-9]+", "_", url)[:120]
                   + "-" + str(abs(hash(url)) % 10**10) + ".html")
    if key.exists():
        body = key.read_text(encoding="utf-8")
        return body or None

    request = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        with _GATE:
            gap = MIN_GAP - (time.time() - _LAST[0])
            if gap > 0:
                time.sleep(gap)
            _LAST[0] = time.time()
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                body = response.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as error:
            if error.code == 404:
                key.write_text("", encoding="utf-8")
                return None
            if error.code in (429, 503):
                time.sleep(5 * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(3 * (attempt + 1))
            continue
        key.write_text(body, encoding="utf-8")
        return body
    raise RuntimeError(f"gave up fetching {url}")


def _page_url(base: str, title: str) -> str:
    return base + urllib.parse.quote(title.replace(" ", "_"))


def _content(html: str) -> BeautifulSoup | None:
    soup = BeautifulSoup(html, "html.parser")
    body = soup.select_one("#mw-content-text .mw-parser-output")
    if body is None:
        return None
    for tag in body.select(
        "table, figure, .thumb, style, script, .mw-editsection, .navbox, "
        ".reflist, .mw-references-wrap, sup.reference, .hatnote, .shortdescription, "
        ".metadata, .sistersitebox, .noprint"
    ):
        tag.decompose()
    return body


# --- Wikibooks Cookbook ------------------------------------------------------

INGREDIENT_HEAD = re.compile(r"^ingredients?\b", re.I)
METHOD_HEAD = re.compile(
    r"^(procedures?|methods?|directions?|preparation|instructions?)\b", re.I)
# Unanchored, because these words rarely head their own heading: the Coq au
# Vin page calls its equipment list "Special equipment", and anchoring meant
# the section stayed in ingredients mode and put a skillet and a jug in the
# recipe.
STOP_HEAD = re.compile(
    r"\b(notes|tips|variations?|see also|references|external links|equipment|"
    r"utensils|nutrition|warnings?|history|categor|storage|serving suggestion)\b",
    re.I)


@dataclass
class CookbookRecipe:
    url: str
    ingredients: list[str]
    instructions: list[str]


def _ingredient_table(html: str) -> list[str]:
    """Lines from the Cookbook's newer tabular ingredient template.

    Some pages tabulate ingredients - Ingredient | Count | Volume | Weight -
    instead of listing them. The weight column is better data than anything a
    bullet gives, so it is worth reading rather than treating the page as
    having no ingredients at all.
    """
    soup = BeautifulSoup(html, "html.parser")
    lines: list[str] = []
    for table in soup.select("#mw-content-text .mw-parser-output table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        headers = [c.get_text(" ", strip=True).lower()
                   for c in rows[0].find_all(["th", "td"])]
        if not headers or "ingredient" not in headers[0]:
            continue
        index = {name: position for position, name in enumerate(headers)}
        for row in rows[1:]:
            cells = [c.get_text(" ", strip=True) for c in row.find_all(["th", "td"])]
            if len(cells) != len(headers):
                continue
            name = re.sub(r"[\[\]]", "", cells[0]).strip()
            if not name or name.lower() == "ingredient":
                continue
            # Weight is the measurement; count and volume are the fallbacks.
            for column in ("weight", "volume", "count"):
                position = index.get(column)
                if position is None:
                    continue
                amount = cells[position].strip()
                if amount and amount not in {"-", "–", "—", ""}:
                    lines.append(f"{amount} {name}")
                    break
            else:
                lines.append(name)
    return lines


def cookbook_recipe(title: str) -> CookbookRecipe | None:
    """The Ingredients and Procedure sections of a Cookbook page, verbatim."""
    url = _page_url(WIKIBOOKS, title)
    html = fetch(url)
    if not html:
        return None
    tabulated = _ingredient_table(html)
    body = _content(html)
    if body is None:
        return None

    ingredients: list[str] = []
    instructions: list[str] = []
    mode: str | None = None

    for node in body.find_all(["h1", "h2", "h3", "h4", "ul", "ol", "p"]):
        if node.name in ("h1", "h2", "h3", "h4"):
            heading = node.get_text(" ", strip=True)
            if INGREDIENT_HEAD.match(heading):
                mode = "ingredients"
            elif METHOD_HEAD.match(heading):
                mode = "instructions"
            elif STOP_HEAD.search(heading):
                mode = None
            # A sub-heading inside a section ("For the sauce") keeps the mode.
            continue

        if mode is None:
            continue

        if node.name in ("ul", "ol"):
            for item in node.find_all("li", recursive=False):
                text = item.get_text(" ", strip=True)
                if text:
                    (ingredients if mode == "ingredients" else instructions).append(text)
        elif node.name == "p" and mode == "instructions":
            # Some pages write the method as prose rather than a list.
            text = node.get_text(" ", strip=True)
            if len(text) > 30:
                instructions.extend(
                    s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[A-Z])", text) if s.strip()
                )

    if not ingredients:
        ingredients = tabulated
    if not ingredients or not instructions:
        return None
    return CookbookRecipe(url=url, ingredients=ingredients, instructions=instructions)


# --- Wikipedia ---------------------------------------------------------------

# Images that are not a photograph of the dish. The second group is the one
# that matters in practice: food articles lead surprisingly often with the
# premises rather than the plate - the Poutine article opens on a restaurant
# front - and a picture of a building is worse than no picture at all.
NOT_A_DISH = re.compile(
    r"(logo|icon|flag|map|coat.of.arms|wiki|commons|symbol|edit|ambox|"
    r"question_book|disambig|padlock|speaker|loudspeaker|barnstar"
    r"|restaurant|storefront|shopfront|exterior|signage|billboard|menu_"
    r"|festival|portrait|statue|monument|poster|stamp|advert)", re.I)


@dataclass
class WikipediaPage:
    url: str
    description: str
    image_file: str
    """Commons file name, e.g. "Spaghetti alla Carbonara.jpg"."""
    image_source_url: str


def _lead_paragraph(soup: BeautifulSoup) -> str:
    body = soup.select_one("#mw-content-text .mw-parser-output")
    if body is None:
        return ""
    for paragraph in body.find_all("p", recursive=True):
        for tag in paragraph.select("sup.reference, .mw-editsection, style"):
            tag.decompose()
        text = paragraph.get_text(" ", strip=True)
        text = re.sub(r"\s*\([^()]*\)", "", text)          # pronunciations
        text = re.sub(r"\[\d+\]", "", text)
        text = re.sub(r"\s+", " ", text)
        # Every wikilink is its own element, so getting the text of a paragraph
        # puts a space in front of the punctuation that follows one: "braised
        # in red wine , often red Burgundy , and beef stock".
        text = re.sub(r"\s+([,.;:!?%])", r"\1", text)
        text = re.sub(r"([([{])\s+", r"\1", text).strip()
        if len(text) > 60:
            # One sentence is all the app has room for.
            sentence = re.split(r"(?<=[.!?])\s+", text)[0]
            return sentence[:400]
    return ""


def _commons_file(src: str) -> str | None:
    """The original Commons file name behind a thumbnail URL, if it is on Commons."""
    if "/wikipedia/commons/" not in src:
        return None
    match = re.search(r"/wikipedia/commons/(?:thumb/)?[0-9a-f]/[0-9a-f]{2}/([^/?]+)", src)
    if not match:
        return None
    name = urllib.parse.unquote(match.group(1))
    if NOT_A_DISH.search(name) or name.lower().endswith((".svg", ".gif")):
        return None
    return name


def wikipedia_page(title: str) -> WikipediaPage | None:
    """Lead sentence and lead photograph for a dish."""
    url = _page_url(WIKIPEDIA, title)
    html = fetch(url)
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")

    candidates: list[str] = []
    infobox = soup.select_one("table.infobox")
    if infobox:
        candidates += [img.get("src", "") for img in infobox.select("img")]
    candidates += [img.get("src", "") for img in
                   soup.select("#mw-content-text .mw-parser-output img")]

    image_file = None
    for src in candidates:
        if not src:
            continue
        name = _commons_file(src)
        if name:
            image_file = name
            break
    if image_file is None:
        return None

    return WikipediaPage(
        url=url,
        description=_lead_paragraph(soup),
        image_file=image_file,
        image_source_url=COMMONS_FILE + urllib.parse.quote(image_file.replace(" ", "_")),
    )


# --- Commons -----------------------------------------------------------------

@dataclass
class ImageCredit:
    file: str
    author: str
    license: str
    license_url: str
    source_url: str
    download_url: str


LICENSE_URLS = {
    "cc by-sa 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
    "cc by-sa 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "cc by-sa 2.5": "https://creativecommons.org/licenses/by-sa/2.5/",
    "cc by-sa 2.0": "https://creativecommons.org/licenses/by-sa/2.0/",
    "cc by 4.0": "https://creativecommons.org/licenses/by/4.0/",
    "cc by 3.0": "https://creativecommons.org/licenses/by/3.0/",
    "cc by 2.0": "https://creativecommons.org/licenses/by/2.0/",
    "cc0": "https://creativecommons.org/publicdomain/zero/1.0/",
    # Longest key first: _license_url matches by prefix, so "gfdl 1.2" has to
    # be tried before the bare "gfdl".
    "gfdl 1.2": "https://www.gnu.org/licenses/old-licenses/fdl-1.2.html",
    "gfdl": "https://www.gnu.org/licenses/fdl-1.3.html",
    "public domain": "https://commons.wikimedia.org/wiki/Commons:Licensing",
}


# A {{Creator:...}} template renders the photographer's name followed by every
# authority-control identifier Wikidata holds for them. The name is the credit;
# "VIAF : 13441794 ISNI : 0000..." is not.
AUTHORITY = re.compile(
    r"\b(VIAF|ISNI|GND|LCCN|BNF|SUDOC|NLA|ULAN|RKD|Wikidata|Q\d{4,})\b.*",
    re.IGNORECASE | re.DOTALL)


def _tidy_author(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"^(author|artist|photographer|creator)\s*:?\s*", "", text, flags=re.I)
    text = AUTHORITY.sub("", text)
    # A retouched file credits itself as "<original filename> derivative work:
    # <editor>". The filename is not a person, so it goes before the
    # derivative-work label is stripped - otherwise the filename is all that
    # survives.
    text = re.sub(r"\S+\.(jpe?g|png|gif|tiff?|webp|svg)\b", " ", text, flags=re.I)
    text = re.sub(r"\b(derivative work|retouched by|edited by)\s*:?\s*", "",
                  text, flags=re.I)
    # Upload provenance, not authorship.
    text = re.sub(r"\s*(the )?original uploader\b.*", "", text,
                  flags=re.I | re.DOTALL)
    text = re.sub(r"\b(talk|contribs|user)\b", "", text, flags=re.I)
    text = re.sub(r"\(\s*\)", " ", text)
    text = re.sub(r"\s*\|\s*", " ", text).strip(" -–—|,:")
    return text[:120] or "Unknown"


def _normalise_license(name: str) -> str:
    return re.sub(r"[\s-]+", " ", name.lower()).strip()


def _license_url(name: str) -> str:
    key = _normalise_license(name)
    for prefix, url in LICENSE_URLS.items():
        if key.startswith(_normalise_license(prefix)):
            return url
    return "https://commons.wikimedia.org/wiki/Commons:Licensing"


# Commons' thumbnailer only serves a fixed set of widths and answers 400 to
# anything else. 1280 is the largest of the useful ones; the build downscales
# from there to what a phone screen can actually show.
THUMB_WIDTH = 1280


def image_credit(file_name: str, width: int = THUMB_WIDTH) -> ImageCredit | None:
    """Author and licence for a Commons file, plus a URL to download it at."""
    source_url = COMMONS_FILE + urllib.parse.quote(file_name.replace(" ", "_"))
    html = fetch(source_url)
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")

    author = "Unknown"
    # A {{Creator:...}} template nests an entire biography table inside the
    # Author row - description, dates, birthplace, authority files - so walking
    # to the row's last cell lands on the VIAF numbers. The template puts the
    # name itself at #creator, which is the only reliable place to read it.
    creator = soup.select_one("#creator")
    if creator:
        author = _tidy_author(creator.get_text(" ", strip=True))
    if author in ("", "Unknown"):
        node = soup.select_one("#fileinfotpl_aut")
        if node and node.find_parent("tr"):
            cells = node.find_parent("tr").find_all("td")
            if len(cells) > 1:
                author = _tidy_author(cells[1].get_text(" ", strip=True))

    licence = "Unknown"
    short = soup.select_one(".licensetpl_short")
    if short:
        licence = re.sub(r"\s+", " ", short.get_text(" ", strip=True)).strip()
    elif soup.find(string=re.compile("public domain", re.I)):
        licence = "Public domain"

    # The full-size original can be 8 MB; ask the thumbnailer for something a
    # phone can actually use.
    original = None
    full = soup.select_one(".fullImageLink a")
    if full and full.get("href"):
        href = full["href"]
        href = ("https:" + href) if href.startswith("//") else href
        # Commons appends campaign tracking to the link; it is not part of the
        # path the thumbnailer keys on.
        original = urllib.parse.urljoin(href, urllib.parse.urlparse(href).path)
    if not original:
        return None

    thumb = re.sub(r"/commons/([0-9a-f])/([0-9a-f]{2})/",
                   r"/commons/thumb/\1/\2/", original)
    if thumb != original:
        thumb = f"{thumb}/{width}px-{thumb.rsplit('/', 1)[-1]}"

    return ImageCredit(
        file=file_name,
        author=author,
        license=licence,
        license_url=_license_url(licence),
        source_url=source_url,
        download_url=thumb,
    )
