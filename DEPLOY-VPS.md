# Вариант A: свой VPS + Nginx + Let's Encrypt

Пошаговая инструкция для Linux-VPS (Ubuntu/Debian). В примерах замените:

- `IP` — публичный IP сервера;
- `example.com` — ваш домен;
- `deploy` — имя пользователя для деплоя.

Если сервер на Windows Server, эта инструкция не подойдёт: там нужен IIS + Win-acme либо отдельный Linux-VPS.

---

## 0. Что понадобится

1. Доступ к панели провайдера VPS (там же консоль сервера, если SSH не пускает).
2. Публичный IP сервера.
3. Домен и доступ к панели DNS у регистратора.
4. 15–30 минут.

Пароль от сервера в чат не присылайте. Для работы нужен SSH-ключ.

---

## 1. Сделайте SSH-ключ на Windows

Откройте PowerShell.

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh" | Out-Null
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\gcode_deploy" -C "gcode-deploy"
```

На вопрос о парольной фразе можно нажать Enter (без пароля) или задать свой пароль — тогда его нужно будет вводить при каждом подключении.

Покажите публичный ключ:

```powershell
Get-Content "$env:USERPROFILE\.ssh\gcode_deploy.pub"
```

Получится одна строка, начинающаяся с `ssh-ed25519 ...`. Это **публичный** ключ, его можно передавать. Файл `gcode_deploy` без `.pub` — **приватный**, его никому не отправляйте.

---

## 2. Создайте пользователя на сервере

Зайдите на сервер через консоль провайдера или как root:

```bash
ssh root@IP
```

Создайте отдельного пользователя:

```bash
adduser deploy
usermod -aG sudo deploy
```

Если `adduser` нет (AlmaLinux/RHEL):

```bash
useradd -m -s /bin/bash deploy
passwd deploy
usermod -aG wheel deploy
```

Добавьте публичный ключ:

```bash
mkdir -p /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys
```

Вставьте туда строку `ssh-ed25519 ...` из шага 1, сохраните (`Ctrl+O`, Enter, `Ctrl+X`).

Выставьте права:

```bash
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Проверьте вход с Windows **в новом окне** PowerShell:

```powershell
ssh -i "$env:USERPROFILE\.ssh\gcode_deploy" deploy@IP
```

Должны войти без пароля. Если просит пароль — ключ не подхватился, см. раздел «Если не работает».

> Не отключайте вход по паролю и не закрывайте текущую сессию, пока не убедитесь, что вход по ключу работает.

---

## 3. Настройте DNS

В панели регистратора или DNS-провайдера добавьте:

| Тип | Имя | Значение | TTL |
|-----|-----|----------|-----|
| A | `@` | `IP` | 300 |
| CNAME | `www` | `example.com` | 300 |

Если для `www` нельзя CNAME, добавьте второй A-запись с тем же IP.

Важно:

- не меняйте `MX` и `TXT`, если на домене есть почта;
- если на домене уже есть старый сайт, замена A-записи переключит домен на новый сервер;
- если домен на Cloudflare, на время первой настройки поставьте **DNS only** (серая тучка), а не Proxied.

Проверка с Windows:

```powershell
Resolve-DnsName example.com -Type A
Resolve-DnsName www.example.com -Type A
```

Должен появиться ваш IP. Иногда нужно подождать 5–30 минут.

---

## 4. Установите Nginx и Certbot

На сервере:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx ufw
```

Проверьте, что Nginx работает:

```bash
nginx -v
sudo systemctl status nginx --no-pager
```

Проверьте, не заняты ли порты другим веб-сервером:

```bash
sudo ss -ltnp | grep -E ':80|:443'
```

Если там Apache и это чистый новый сервер:

```bash
sudo systemctl stop apache2
sudo systemctl disable apache2
```

Если на сервере уже есть рабочие сайты на Apache — не останавливайте его, напишите мне, разберём отдельно.

---

## 5. Откройте порты

На сервере:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status verbose
```

Если SSH работает не на 22-м порту, вместо `OpenSSH` откройте свой порт:

```bash
sudo ufw allow 2222/tcp
```

Отдельно проверьте **firewall в панели провайдера** (Security Group / Firewall): должны быть разрешены входящие TCP 22 (или ваш SSH-порт), 80 и 443. Это частая причина, почему сайт не открывается, хотя Nginx работает.

---

## 6. Загрузите сайт

На сервере создайте папку:

```bash
sudo mkdir -p /var/www/gcode
sudo chown -R deploy:deploy /var/www/gcode
```

С Windows загрузите файл (путь к файлу проверьте свой):

```powershell
scp -i "$env:USERPROFILE\.ssh\gcode_deploy" `
  "C:\Users\Kozip\Downloads\gcode-universal.html" `
  deploy@IP:/var/www/gcode/index.html
```

Если файл лежит в рабочей папке проекта:

```powershell
scp -i "$env:USERPROFILE\.ssh\gcode_deploy" `
  "C:\Users\Kozip\OneDrive\Документы\deepseek-harness\default-workspace\gcode-universal.html" `
  deploy@IP:/var/www/gcode/index.html
```

На сервере проверьте:

```bash
ls -l /var/www/gcode/index.html
```

Права должны быть `-rw-r--r--` (644). Если нет:

```bash
chmod 644 /var/www/gcode/index.html
```

---

## 7. Создайте конфиг Nginx

```bash
sudo nano /etc/nginx/sites-available/gcode
```

Вставьте:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    root /var/www/gcode;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Включите сайт:

```bash
sudo ln -sf /etc/nginx/sites-available/gcode /etc/nginx/sites-enabled/gcode
sudo nginx -t
sudo systemctl reload nginx
```

Если `nginx -t` пишет про конфликт `default server` или `duplicate server name`, отключите стандартный сайт (только если он не нужен):

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Проверьте HTTP:

```powershell
curl.exe -I http://example.com
```

Ожидается `HTTP/1.1 200 OK`. Если DNS ещё не разошёлся, можно проверить по IP с подменой Host:

```powershell
curl.exe -I -H "Host: example.com" http://IP/
```

---

## 8. Выпустите HTTPS-сертификат

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

Certbot спросит e-mail, согласие и предложит перенаправлять HTTP → HTTPS. Согласитесь.

Проверьте автопродление:

```bash
sudo certbot renew --dry-run
```

Проверьте, что таймер включён:

```bash
systemctl list-timers --all | grep certbot
```

Certbot сам правит конфиг Nginx и перезагружает его. После этого сайт должен открываться по `https://example.com`.

---

## 9. Финальная проверка

С Windows:

```powershell
curl.exe -I https://example.com
curl.exe -I https://www.example.com
```

Оба адреса должны отвечать `200 OK`, без предупреждений сертификата.

В браузере:

- `https://example.com` — открывается ваш G-CODE STUDIO;
- `http://example.com` — перенаправляется на HTTPS;
- `https://www.example.com` — тоже работает.

Проверьте, что домен резолвится в ваш IP:

```powershell
Resolve-DnsName example.com -Type A
```

---

## 10. Что прислать мне, чтобы я доделал сам

После шагов 1–3 (ключ, пользователь, DNS) пришлите:

1. `IP` сервера;
2. SSH-порт (обычно 22);
3. пользователя (`deploy`);
4. путь к приватному ключу на вашем ПК (обычно `C:\Users\Kozip\.ssh\gcode_deploy`);
5. домен;
6. подтверждение, что DNS A-запись уже указывает на IP;
7. есть ли на сервере уже другие сайты.

Пароль и приватный ключ не присылайте. После этого я смогу:

- зайти по SSH;
- провести read-only аудит;
- установить/настроить Nginx;
- загрузить сайт;
- выпустить сертификат;
- проверить HTTPS.

Если хотите, чтобы я сделал всё с нуля, можно дать временный доступ root по ключу — но лучше отдельный `deploy` с `sudo`.

---

## Если не работает

### `Permission denied (publickey)`

На сервере проверьте:

```bash
sudo nano /etc/ssh/sshd_config
```

Должно быть:

```text
PubkeyAuthentication yes
```

Права:

```bash
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

На AlmaLinux/RHEL ещё:

```bash
sudo restorecon -R -v /home/deploy/.ssh
```

Проверьте, что ключ добавлен именно пользователю `deploy`, а не root.

### Домен не открывается

- `Resolve-DnsName example.com` показывает не тот IP — поправьте A-запись, подождите TTL.
- Порты 80/443 закрыты в `ufw` или в firewall провайдера.
- Nginx не запущен: `sudo systemctl status nginx`.
- Не тот `server_name`: `sudo nginx -T | grep server_name`.

### `403 Forbidden`

- нет `index.html` в `/var/www/gcode`;
- неправильные права: `chmod 644`, папки `755`;
- SELinux: `sudo restorecon -R -v /var/www/gcode`.

### `404 Not Found`

- `root` в конфиге указывает не туда;
- файл называется не `index.html`;
- сайт не включён симлинком в `sites-enabled`.

### Certbot: `Timeout during connect`

- DNS ещё не указывает на сервер;
- закрыт 80-й порт;
- Cloudflare стоит в режиме Proxied, а SSL-режим неправильный;
- на сервере несколько IP или IPv6 указывает не туда.

Для Cloudflare на время выпуска сертификата переключите запись в **DNS only**, выпустите сертификат, затем включите Proxied и режим **Full (strict)**. Режим **Flexible** часто даёт цикл редиректов.

### `too many redirects`

Обычно Cloudflare SSL = Flexible, а Nginx перенаправляет на HTTPS. Поставьте **Full (strict)** и убедитесь, что на origin есть валидный сертификат.

### Потеряли SSH-доступ

Не паникуйте: зайдите в консоль провайдера (VNC/Serial) и проверьте `sshd_config`, права и firewall. Поэтому не отключайте пароль до проверки ключа.

---

## Мини-чек-лист

- [ ] SSH-ключ создан, публичная часть добавлена пользователю `deploy`.
- [ ] Вход `ssh -i ... deploy@IP` работает.
- [ ] A-запись домена указывает на IP.
- [ ] Nginx установлен, порты 80/443 открыты.
- [ ] Файл лежит в `/var/www/gcode/index.html`.
- [ ] Конфиг Nginx включён, `nginx -t` без ошибок.
- [ ] `http://example.com` открывается.
- [ ] Certbot выпустил сертификат, `https://` работает.
- [ ] `certbot renew --dry-run` без ошибок.
