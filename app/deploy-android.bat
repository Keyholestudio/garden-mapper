@echo off
echo === Garden Mapper — Android Deploy ===
echo.

:: Set paths
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;C:\Users\RG\AppData\Local\Android\Sdk\platform-tools;%PATH%

:: Check device connected
echo [1/4] Checking for connected device...
adb devices | findstr /v "List of" | findstr "device"
if errorlevel 1 (
    echo ERROR: No device found. Connect phone via USB and enable USB Debugging, then retry.
    pause
    exit /b 1
)

:: Build web assets
echo [2/4] Building web assets...
cd /d "%~dp0"
call npm run build
if errorlevel 1 (
    echo ERROR: Web build failed.
    pause
    exit /b 1
)

:: Sync to Android
echo [3/4] Syncing to Android...
call npx cap sync android
if errorlevel 1 (
    echo ERROR: Capacitor sync failed.
    pause
    exit /b 1
)

:: Build APK
echo [4/4] Building APK...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo ERROR: Gradle build failed.
    pause
    exit /b 1
)

:: Install on device
echo.
echo === Installing on device ===
adb install -r "%~dp0android\app\build\outputs\apk\debug\app-debug.apk"
if errorlevel 1 (
    echo ERROR: adb install failed. Is the phone still connected?
    pause
    exit /b 1
)

echo.
echo === Done! Garden Mapper updated on your phone. ===
pause
