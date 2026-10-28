FROM dxflrs/garage:v2.3.0 AS garage
FROM alpine:3.22
COPY --from=garage /garage /garage
COPY garage.toml /etc/garage.toml
COPY docker/garage/init.sh /usr/local/bin/garage-init
RUN chmod +x /usr/local/bin/garage-init
ENTRYPOINT ["/bin/sh", "/usr/local/bin/garage-init"]
