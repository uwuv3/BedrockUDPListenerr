@echo off
:: Yönetici yetkisi kontrolü
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Yönetici hakları gerekiyor...
    :: Yönetici olarak yeniden çalıştırma ve bulunduğu klasörde açma
    powershell -Command "Start-Process cmd -ArgumentList '/k cd /d %~dp0' -Verb runAs"
    exit /b
)

:: Eğer yönetici yetkisiyle zaten açıldıysa, bu komutlar çalışır.
echo Bu pencere yönetici yetkileriyle çalışıyor.
pause
