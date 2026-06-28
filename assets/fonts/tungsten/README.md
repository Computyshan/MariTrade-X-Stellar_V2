# Tungsten font files

Drop your licensed Tungsten font files into this folder using these
exact filenames (or update the `src` paths in `app/layout.tsx` to match
whatever you have):

```
assets/fonts/tungsten/Tungsten-Medium.woff2
assets/fonts/tungsten/Tungsten-Medium.woff   (optional fallback)
```

Tungsten is normally licensed as OTF, sold by Hoefler&Co (typography.com).
For the smallest file size and best browser support, convert the OTF to
WOFF2 (e.g. via https://transfonter.org or `fonttools`/`sfnt2woff-zopfli`
locally), then place the resulting file here with the name above.

Once the file exists, `app/layout.tsx` will pick it up automatically via
`next/font/local` — no other code changes are needed. If you only have
one weight of Tungsten (Medium), that's all this app uses, so you're set.

If your file is named differently, edit the `src` field in the
`tungsten` font definition near the top of `app/layout.tsx`.
