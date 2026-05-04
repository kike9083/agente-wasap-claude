FROM alpine:3.18

RUN echo "Build OK"

EXPOSE 3000

CMD ["echo", "Container running"]
