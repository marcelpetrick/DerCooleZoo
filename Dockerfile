# SPDX-FileCopyrightText: 2026 Marcel Petrick
# SPDX-License-Identifier: GPL-3.0-or-later
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
ARG VERSION=development
ARG REVISION=unknown
LABEL org.opencontainers.image.title="Der coole Zoo" \
      org.opencontainers.image.description="A kind, isometric zoo-building browser game for ages eight and up" \
      org.opencontainers.image.source="https://github.com/marcelpetrick/DerCooleZoo" \
      org.opencontainers.image.licenses="GPL-3.0-or-later" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html
COPY --chown=101:101 LICENSE /usr/share/nginx/html/LICENSE
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
