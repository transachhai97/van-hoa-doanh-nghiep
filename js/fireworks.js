class Firework {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        this.lifespan = 100; // Giảm thời gian sống
        this.hue = Math.random() * 360;
        this.init();
    }

    init() {
        for (let i = 0; i < 50; i++) { // Giảm số lượng hạt từ 150 xuống 50
            const particle = {
                x: this.x,
                y: this.y,
                vx: Math.random() * 6 - 3, // Giảm tốc độ từ 8 xuống 6
                vy: Math.random() * 6 - 3,
                radius: Math.random() * 2 + 1, // Giảm kích thước hạt
                alpha: 1,
                hue: this.hue + Math.random() * 50 - 25
            };
            this.particles.push(particle);
        }
    }

    update() {
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.05; // Add gravity
            particle.alpha -= 0.01; // Tăng tốc độ mờ dần
            particle.radius *= 0.99;
        });
        this.lifespan--;
    }

    draw(ctx) {
        ctx.globalCompositeOperation = 'lighter';
        this.particles.forEach(particle => {
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${particle.hue}, 100%, 60%, ${particle.alpha})`;
            ctx.fill();
        });
    }

    isDead() {
        return this.lifespan <= 0;
    }
}

export class FireworksManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.fireworks = [];
        this.isRunning = false;
        this.lastFireworkTime = 0;
    }

    toggle() {
        if (this.isRunning) {
            this.stop();
        } else {
            this.start();
        }
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.animate();
        }
    }

    stop() {
        this.isRunning = false;
        // Clear the canvas when stopping
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    addFirework() {
        const x = Math.random() * this.canvas.width;
        const y = Math.random() * this.canvas.height;
        this.fireworks.push(new Firework(x, y));
    }

    animate(currentTime) {
        if (!this.isRunning) return;

        if (currentTime - this.lastFireworkTime > 100) { // Add new firework every 100ms
            this.addFirework();
            this.lastFireworkTime = currentTime;
        }

        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalCompositeOperation = 'lighter';

        this.fireworks = this.fireworks.filter(firework => {
            firework.update();
            firework.draw(this.ctx);
            return !firework.isDead();
        });

        requestAnimationFrame((time) => this.animate(time));
    }
}
