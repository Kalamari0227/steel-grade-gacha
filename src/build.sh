#!/bin/bash
# 재료를 합쳐 index.html 한 장으로 만든다.
#   app_tpl.html 의 __P1__ 같은 빈칸에 img/ · itemimg/ 의 그림을 base64로 밀어 넣고,
#   앞뒤로 pwa_head.txt · pwa_body.txt 를 붙여 저장소 뿌리에 index.html 을 쓴다.
# 쓰는 법:  bash src/build.sh
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SRC/.." && pwd)"
IMG="$SRC/img"; IT="$SRC/itemimg"
TMP="$SRC/.sub.txt"; : > "$TMP"

pair(){
  if [ -n "$2" ] && [ -f "$2" ]; then
    printf '%s\tdata:%s;base64,%s\n' "$1" "$3" "$(base64 -w0 "$2")" >> "$TMP"
  else
    printf '%s\t\n' "$1" >> "$TMP"
    echo "  (그림 없음) $1 -> $2" >&2
  fi
}
# 포오 — CQ DQ DDQ EDDQ 440W 590Y 780Y
pair __P1__ "$IMG/poo.jpg"     image/jpeg
pair __P2__ "$IMG/p_dq.jpg"    image/jpeg
pair __P3__ "$IMG/p_ddq.jpg"   image/jpeg
pair __P8__  "$IMG/p_370w.jpg"  image/jpeg
pair __P5__ "$IMG/ht_2.jpg"    image/jpeg
pair __P6__ "$IMG/y590_b.jpg"  image/jpeg
pair __P7__ "$IMG/n780_3.jpg"  image/jpeg

# 씨알 — CQ DQ DDQ EDDQ S-EDDQ 440W 590Y 780Y 980Y 1180Y
pair __S1__  "$IMG/ssial.jpg"   image/jpeg
pair __S2__  "$IMG/c_dq.jpg"    image/jpeg
pair __S3__  "$IMG/c_ddq.jpg"   image/jpeg
pair __S4__  "$IMG/c_eddq.jpg"  image/jpeg
pair __S5__  "$IMG/c_seddq.jpg" image/jpeg
pair __S6__  "$IMG/ht_3.jpg"    image/jpeg
pair __S7__  "$IMG/y590_a.jpg"  image/jpeg
pair __S8__  "$IMG/n780_2.jpg"  image/jpeg
pair __S9__  "$IMG/c_980.jpg"   image/jpeg
pair __S10__ "$IMG/c_1180.jpg"  image/jpeg
pair __S13__ "$IMG/c_340w.jpg"   image/jpeg
pair __S11__ "$IMG/c_bh.jpg"    image/jpeg
pair __S12__ "$IMG/c_mart.jpg"    image/jpeg

# 도금이 — CQ DQ DDQ EDDQ S-EDDQ 440W 590Y 780Y 980Y 1180Y
pair __G1__  "$IMG/dogeum.jpg"  image/jpeg
pair __G2__  "$IMG/g_dq.jpg"    image/jpeg
pair __G3__  "$IMG/g_ddq.jpg"   image/jpeg
pair __G4__  "$IMG/g_eddq.jpg"  image/jpeg
pair __G5__  "$IMG/g_seddq.jpg" image/jpeg
pair __G6__  "$IMG/ht_1.jpg"    image/jpeg
pair __G7__  "$IMG/y590_c.jpg"  image/jpeg
pair __G8__  "$IMG/n780_1.jpg"  image/jpeg
pair __G9__  "$IMG/g_980.jpg"   image/jpeg
pair __G10__ "$IMG/g_1180.jpg"  image/jpeg
pair __G12__ "$IMG/g_340w.jpg"   image/jpeg
pair __G11__ "$IMG/g_bh.jpg"    image/jpeg

# 아이템 아홉 종
pair __H1__ "$IMG/p_phs_a.jpg"  image/jpeg
pair __H2__ "$IMG/p_phs_b.jpg"  image/jpeg
pair __H3__ "$IMG/g_hpf_a.jpg"  image/jpeg
pair __H4__ "$IMG/g_hpf_b.jpg"  image/jpeg

pair __I1__ "$IT/shield.png"    image/png
pair __I2__ "$IT/dagger.png"    image/png
pair __I3__ "$IT/potion.png"    image/png
pair __I4__ "$IT/arrow.png"     image/png
pair __I5__ "$IT/forge.png"     image/png
pair __I6__ "$IT/flange.png"    image/png
pair __I7__ "$IT/iron.png"      image/png
pair __I8__ "$IT/spark.png"     image/png
pair __I9__ "$IT/hourglass.png" image/png

# 선재용 다섯 — 그림 대기
pair __I10__ "$IT/kettle.png"   image/png
pair __I11__ "$IT/loupe.png"    image/png
pair __I12__ "$IT/bath.png"     image/png
pair __I13__ "$IT/jominy.png"   image/png
pair __I14__ "$IT/section.png"  image/png

# 타래 — 선재 열 종
pair __W1__  "$IMG/wr_swrm.jpg"  image/jpeg
pair __W3__  "$IMG/wr_swry.jpg"  image/jpeg
pair __W4__  "$IMG/wr_swrh.jpg"  image/jpeg
pair __W5__  "$IMG/wr_cord.jpg"  image/jpeg
pair __W6__  "$IMG/wr_chq.jpg"   image/jpeg
pair __W7__  "$IMG/wr_suj.jpg"   image/jpeg
pair __W8__  "$IMG/wr_spr.jpg"   image/jpeg
pair __W9__  "$IMG/wr_vlv.jpg"   image/jpeg
pair __W10__ "$IMG/wr_nht.jpg"   image/jpeg

# 이지(EG) — 연료탱크용 편면 도금재
pair __E1__  "$IMG/eg_secc.jpg"  image/jpeg

# 자동차 부품 (34종) — src/partimg · 번호는 그림 파일 번호와 같습니다
PT="$SRC/partimg"
pair __C1__  "$PT/roof.png"     image/png
pair __C2__  "$PT/hood.png"     image/png
pair __C3__  "$PT/fender.png"   image/png
pair __C4__  "$PT/sideo.png"    image/png
pair __C5__  "$PT/dooro.png"    image/png
pair __C7__  "$PT/trunkin.png"  image/png
pair __C8__  "$PT/trunko.png"   image/png
pair __C9__  "$PT/whouse.png"   image/png
pair __C10__ "$PT/floor.png"    image/png
pair __C11__ "$PT/sill.png"     image/png
pair __C12__ "$PT/bumper.png"   image/png
pair __C13__ "$PT/apillar.png"  image/png
pair __C14__ "$PT/bpillar.png"  image/png
pair __C15__ "$PT/crossm.png"   image/png
pair __C16__ "$PT/impact.png"   image/png
pair __C17__ "$PT/rim.png"      image/png
pair __C18__ "$PT/disc.png"     image/png
pair __C19__ "$PT/tank.png"     image/png
pair __C20__ "$PT/seat.png"     image/png
pair __C21__ "$PT/bearing.png"  image/png
pair __C22__ "$PT/spring.png"   image/png
pair __C23__ "$PT/vspring.png"  image/png
pair __C24__ "$PT/bolt.png"     image/png
pair __C25__ "$PT/tierod.png"   image/png
pair __C26__ "$PT/arm.png"      image/png
pair __C27__ "$PT/clutch.png"   image/png
pair __C28__ "$PT/stabil.png"   image/png
pair __C29__ "$PT/bracket.png"  image/png
pair __C30__ "$PT/reinf.png"    image/png
pair __C31__ "$PT/roofx.png"    image/png
pair __C32__ "$PT/sidemem.png"  image/png
pair __C34__ "$PT/brake.png"    image/png
pair __C35__ "$PT/crank.png"    image/png
pair __C36__ "$PT/conrod.png"   image/png

# 완성차 셋 — src/carimg
pair __V1__ "$SRC/carimg/t.png"  image/png
pair __V2__ "$SRC/carimg/h.png"  image/png
pair __V3__ "$SRC/carimg/n.png"  image/png

awk -F'\t' 'NR==FNR{k[NR]=$1; v[NR]=$2; n=NR; next}
  { for(i=1;i<=n;i++) if(index($0,k[i])) gsub(k[i], v[i]); print }' \
  "$TMP" "$SRC/app_tpl.html" > "$SRC/.app.html"
rm -f "$TMP"

cat "$SRC/pwa_head.txt" "$SRC/.app.html" "$SRC/pwa_body.txt" > "$ROOT/index.html"
rm -f "$SRC/.app.html"
echo "built: $(( $(wc -c < "$ROOT/index.html") / 1024 )) KB"
if grep -q '__[A-Z][0-9]' "$ROOT/index.html"; then echo "!! 빈칸이 남았다"; exit 1; else echo "빈칸: 없음"; fi
