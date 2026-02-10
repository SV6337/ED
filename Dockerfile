FROM node:16-bullseye
RUN apt-get update && apt-get install -y python3 python3-pip && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
RUN pip3 install supervisor
WORKDIR /app
COPY . /app
WORKDIR /app/edcopy
RUN npm install
WORKDIR /app
RUN pip3 install -r HireED/requirements.txt
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
EXPOSE 5000 5001
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]