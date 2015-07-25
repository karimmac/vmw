#!/bin/bash
echo {
  find ~/vm -name "*.vmx" | while read l; do
    bn=$(dirname "${l}")
    bn=$(basename "${bn}")
    bn=${bn%.*}
    bn=${bn// /_}
    bn=${bn//./_}
    echo "  \"${bn}\": { \"path\": \"${l}\" },"
  done | sed -e '$s/,//'
echo }
