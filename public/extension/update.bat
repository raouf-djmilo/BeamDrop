@echo off
title BeamDrop Extension Fast Auto-Updater
echo ========================================================
echo        ⚡ BeamDrop Chrome Extension Fast Updater
echo ========================================================
echo.
echo [1/3] Downloading latest version package from cloud...
curl -L -s "https://beam-drop-mu.vercel.app/extension.zip" -o "beamdrop_update.zip"

if exist "beamdrop_update.zip" (
    echo [2/3] Extracting and replacing extension files...
    tar -xf "beamdrop_update.zip"
    del "beamdrop_update.zip"
    echo [3/3] Done!
    echo.
    echo ========================================================
    echo  ✅ EXTENSION FILES SUCCESSFULLY UPDATED TO LATEST!
    echo.
    echo  Now open chrome://extensions in your browser
    echo  and click the 🔄 reload icon on BeamDrop.
    echo ========================================================
) else (
    echo [ERROR] Download failed. Please check internet connection.
)
echo.
pause
