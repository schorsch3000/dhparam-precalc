FROM node:12-buster
RUN apt-get update && apt-get upgrade -y
ADD . /app
WORKDIR /app
RUN npm i --production
CMD ["node", "/app/index.js"]
EXPOSE 3000