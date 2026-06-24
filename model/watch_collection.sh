#!/bin/bash
# Run this in a terminal: bash ~/Desktop/DepSafe/model/watch_collection.sh
# It checks every 5 minutes and notifies you when collection is done.

while kill -0 83317 2>/dev/null; do
  LAST=$(tail -1 ~/Desktop/DepSafe/model/collection.log)
  echo "$(date '+%H:%M') — $LAST"
  sleep 300
done

echo ""
echo "========================================="
echo "  DATA COLLECTION COMPLETE!"
echo "========================================="
echo ""
echo "Now run:"
echo "  cd ~/Desktop/DepSafe/model && python3.12 train.py"
echo ""

# macOS notification
osascript -e 'display notification "Data collection finished! Run train.py next." with title "DepSafe"'
# Also beep
afplay /System/Library/Sounds/Glass.aiff
