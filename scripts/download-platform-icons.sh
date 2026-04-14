#!/bin/bash
# Download platform icons from Wikimedia Commons
# Run this script if icons are missing: bash scripts/download-platform-icons.sh
# Uses 2-second delay between downloads to avoid rate limiting.

DIR="$(cd "$(dirname "$0")/../public/platforms" && pwd)"
cd "$DIR" || exit 1

download() {
  local name="$1" url="$2"
  if [ -f "$name" ] && file -b "$name" | grep -q "SVG\|PNG"; then
    echo "SKIP: $name (already exists)"
    return
  fi
  sleep 2
  curl -sL -o "$name" "$url"
  if file -b "$name" | grep -q "SVG\|PNG"; then
    echo "OK: $name ($(wc -c < "$name" | tr -d ' ')B)"
  else
    echo "FAIL: $name"
    rm -f "$name"
  fi
}

echo "Downloading platform icons to $DIR"
echo ""

# Nintendo
download "wiiu.svg" "https://upload.wikimedia.org/wikipedia/commons/7/70/Wii_U_logo.svg"
download "virtualboy.svg" "https://upload.wikimedia.org/wikipedia/commons/e/e3/Virtual_Boy_Logo.svg"
download "pokemini.svg" "https://upload.wikimedia.org/wikipedia/commons/0/0c/Pok%C3%A9mon_logo.svg"

# Sony
download "psp.svg" "https://upload.wikimedia.org/wikipedia/commons/4/46/PSP_Logo.svg"
download "psvita.svg" "https://upload.wikimedia.org/wikipedia/commons/3/3d/PlayStation_Vita_logo.svg"
download "ps3.svg" "https://upload.wikimedia.org/wikipedia/commons/0/05/PlayStation_3_logo_%282009%29.svg"

# Microsoft
download "xbox.svg" "https://upload.wikimedia.org/wikipedia/commons/f/f9/Xbox_one_logo.svg"

# Atari
download "atari2600.svg" "https://upload.wikimedia.org/wikipedia/commons/5/58/Atari_Official_2012_Logo.svg"
download "atari5200.svg" "https://upload.wikimedia.org/wikipedia/commons/5/58/Atari_Official_2012_Logo.svg"
download "atari7800.svg" "https://upload.wikimedia.org/wikipedia/commons/5/58/Atari_Official_2012_Logo.svg"
download "jaguar.svg" "https://upload.wikimedia.org/wikipedia/commons/f/f4/Atari_Jaguar_logo.svg"
download "lynx.svg" "https://upload.wikimedia.org/wikipedia/commons/c/c6/Atari_Lynx_logo.svg"

# SNK
download "neogeocd.svg" "https://upload.wikimedia.org/wikipedia/commons/c/c6/Neo_Geo_CD_logo.svg"
download "ngp.svg" "https://upload.wikimedia.org/wikipedia/commons/a/a1/Neo_Geo_Pocket_logo.svg"
download "ngpc.svg" "https://upload.wikimedia.org/wikipedia/commons/a/a1/Neo_Geo_Pocket_logo.svg"

# Sega
download "sega32x.svg" "https://upload.wikimedia.org/wikipedia/commons/3/37/Sega_32X_logo.svg"
download "sg1000.svg" "https://upload.wikimedia.org/wikipedia/commons/0/09/Sega_logo.svg"
download "naomi.svg" "https://upload.wikimedia.org/wikipedia/commons/0/09/Sega_logo.svg"
download "atomiswave.svg" "https://upload.wikimedia.org/wikipedia/commons/0/09/Sega_logo.svg"

# NEC
download "pcengine.svg" "https://upload.wikimedia.org/wikipedia/commons/e/ef/TurboGrafx-16_logo.svg"
download "pcfx.svg" "https://upload.wikimedia.org/wikipedia/commons/e/ef/TurboGrafx-16_logo.svg"

# Bandai
download "wonderswan.svg" "https://upload.wikimedia.org/wikipedia/commons/5/52/WonderSwan_logo.svg"
download "wsc.svg" "https://upload.wikimedia.org/wikipedia/commons/5/52/WonderSwan_logo.svg"

# Other consoles
download "3do.svg" "https://upload.wikimedia.org/wikipedia/commons/f/f5/3DO-Logo.svg"
download "coleco.svg" "https://upload.wikimedia.org/wikipedia/commons/4/4b/ColecoVision_logo.svg"
download "vectrex.svg" "https://upload.wikimedia.org/wikipedia/commons/f/f5/Vectrex_logo.svg"
download "intellivision.svg" "https://upload.wikimedia.org/wikipedia/commons/5/55/Intellivision_logo.svg"

# Computers
download "c64.svg" "https://upload.wikimedia.org/wikipedia/commons/5/5d/Commodore_64_logo.svg"
download "amiga.svg" "https://upload.wikimedia.org/wikipedia/commons/2/2e/Amiga-Logo-1985.svg"
download "msx.svg" "https://upload.wikimedia.org/wikipedia/commons/1/15/MSX_logo.svg"
download "zxspectrum.svg" "https://upload.wikimedia.org/wikipedia/commons/5/51/ZX_Spectrum%2B_logo.svg"
download "amstrad.svg" "https://upload.wikimedia.org/wikipedia/commons/a/a8/Amstrad_CPC_logo.svg"
download "dos.svg" "https://upload.wikimedia.org/wikipedia/commons/b/b0/Ms-dos_icon.svg"

# Arcade / Other
download "arcade.svg" "https://upload.wikimedia.org/wikipedia/commons/e/e2/MAME_Logo.svg"
download "scummvm.svg" "https://upload.wikimedia.org/wikipedia/commons/5/52/ScummVM_logo.svg"

echo ""
echo "Done! Check results above for any FAILs."
