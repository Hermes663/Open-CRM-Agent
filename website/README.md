# ADIKAM — projekt nowej strony www.adikam.com

Statyczna strona firmowa (HTML + CSS + JS, bez zależności zewnętrznych i bez
kroku budowania). **Nie jest nigdzie opublikowana** — to projekt do przeglądu.

## Podgląd lokalny

Wystarczy otworzyć `website/index.html` w przeglądarce, albo:

```bash
npx serve website
# lub
python3 -m http.server 8080 --directory website
```

## Co zawiera

- **Dwujęzyczność PL/EN** — przełącznik w prawym górnym rogu (domyślnie polski;
  angielskie teksty trzymane w atrybutach `data-en`)
- **Sekcje**: hero z CTA, pasek zaufania, „Dlaczego ADIKAM", oferta produktowa
  (6 kategorii), Private Label/OEM z procesem 5 kroków, kalendarz sezonowy,
  jakość i certyfikaty, rynki eksportowe, FAQ, formularz kontaktowy, stopka
- **Responsywność** — układ mobile-first, menu hamburger poniżej 680 px
- **Dostępność** — semantyczny HTML, kontrasty, `prefers-reduced-motion`
- **Wydajność** — zero zewnętrznych fontów/skryptów/obrazów; grafiki to
  inline SVG i gradienty CSS

## Treść

Teksty oparte na bazie wiedzy firmy w `agent-config/KNOWLEDGE.md`
(profil firmy, katalog produktów, MOQ, certyfikaty, kalendarz sezonowy, FAQ).

## Przed publikacją (do zrobienia)

- Podmienić grafiki zastępcze (SVG/gradienty) na prawdziwe zdjęcia produktów
- Podpiąć formularz kontaktowy pod realny backend/usługę (obecnie `mailto:`)
- Zweryfikować dane firmowe (NIP, adres, polityka prywatności / RODO)
- Dodać analitykę i mapę strony, jeśli potrzebne
