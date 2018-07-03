#!/bin/bash

###############################################################################
# "Triages" some of icons at https://github.com/google/material-design-icons
# for testing/demo purposes.
#
# Note for Mac OS:
#   brew install coreutils
#   alias readlink=greadlink
#
###############################################################################

#
# The following characteristics of the extracted set can be observed:
#
# Raster
# - formats: png
# - sizes: 18dp, 24dp, 36dp, 48dp, 144dp
#
# Svg:
# - sizes: 18px, 24px, 48px
#

path_to_google_matdes_icon_repo=${HOME}/github/google/material-design-icons
destination_root=$(readlink -f $(dirname $0)/../demo-data)
mkdir -p $destination_root

echo "destination_root: $destination_root"

cd "$path_to_google_matdes_icon_repo"

store() {
    f=$1 size=$2; format=$3; icon_name=$4;

set -x
    destdir="$destination_root/$format/$size"
    mkdir -p "$destdir"
    cp $f $destdir/$icon_name.$format
set +x
}

raster() {
    find . -type f | \
        egrep '(^\./editor/.*$|^\./hardware/.*$)' | \
        grep -v /ios/ | \
        grep drawable-hdpi | \
        egrep '*_white_[^.]+.[a-z]+' | \
        sort | \
        while read f;
        do
            icon_name=$(echo "$f" | sed -e 's/.*\/ic_\([^.]\+\)_white_[^.]\+\.[^.]\+/\1/g')
            format=$(echo "$f" | sed -e 's/.*\/ic_[^.]\+_white_[^.]\+\.\([^.]\+\)/\1/g')
            size=$(echo "$f" | sed -e 's/.*\/ic_[^.]\+_white_\([^.]\+\)\.[^.]\+/\1/g')
            store $f $size $format $icon_name
        done
}

svg() {
    find . -type f | \
        egrep '(^\./editor/.*$|^\./hardware/.*$)' | \
        grep -v /ios/ | \
        grep svg | \
        sort | \
        while read f;
        do
            icon_name=$(echo "$f" | sed -e 's/.*\/ic_\([^.]\+\)_[^._]\+\.svg/\1/g')
            format=svg
            size=$(echo "$f" | sed -e 's/.*\/ic_[^.]\+_\([^._]\+\)\.svg/\1/g')
            store $f $size $format $icon_name
        done
}

raster
svg
