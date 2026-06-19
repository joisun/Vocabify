#! /bin/bash
for size in 16 32 48 96 128; do
  rsvg-convert -w $size -h $size public/vocabify.svg -o public/icon/${size}.png
done
