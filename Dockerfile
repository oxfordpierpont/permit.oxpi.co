FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html facelift.css facelift-sign-assets.js /usr/share/nginx/html/
COPY public /usr/share/nginx/html/public

EXPOSE 80
