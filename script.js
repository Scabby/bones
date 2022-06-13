let moving_left             = false
let moving_right            = false
let jumping                 = false

const fixed_delta_time      = 16;
const gravity               = 0.04;
const friction              = 0.1
const bounce                = 0 // 0..1
const grounding_distance    = 0.5

const move_force            = 0.15
const jump_force            = 1
const max_velocity          = 10
const stop_velocity         = 0.1

const objects = []


const max_camera_offset             = 32
const camera_offset_multiplier      = 10
const camera_offset_history         = []
const camera_offset_history_length  = 10


const swipe_threshold               = 10;



class Point {
    constructor(x = 0, y = 0) {
        this.x = x
        this.y = y
    }
}

class Vector {
    static up       = new Vector(0, 1)
    static down     = new Vector(0, -1)
    static right    = new Vector(1, 0)
    static left     = new Vector(-1, 0)

    constructor(x = 0, y = 0) {
        this.x = x
        this.y = y
    }

    static scalar_to_vector(scalar, angle_degs) {
        rads = angle_degs * Math.PI / 180

        return new Vector(Math.sin(rads) * scalar, -Math.cos(rads) * scalar)
    }

    static clamp_magnitude(vector, magnitude) {
        let m = Vector.magnitude(vector)

        if(m <= magnitude) { return new Vector(vector.x, vector.y) }

        let out_vec = Vector.normalize(vector)
        out_vec.x *= magnitude
        out_vec.y *= magnitude

        return out_vec
    }

    static magnitude(vector) {
        return Math.sqrt((vector.x * vector.x) + (vector.y * vector.y))
    }

    static normalize(vector) {
        let magnitude   = Vector.magnitude(vector);
        let out_vec     = new Vector(0, 0)

        if(magnitude === 1 || magnitude === 0) { return vector }

        out_vec.x = vector.x / magnitude
        out_vec.y = vector.y / magnitude

        return out_vec
    }

    static add(vector, other) {
        return new Vector(vector.x + other.x, vector.y + other.y)
    }

    static substract(vector, other) {
        return new Vector(vector.x - other.x, vector.y -= other.y)
    }
}

class Rectangle {
    constructor(
        width           = 1,
        height          = 1,
        position        = new Point(0, 0),
        mass            = 1,
        velocity        = new Vector(0, 0),
        is_immovable    = false,
        is_player       = false
    ) {
        this.width          = width
        this.height         = height
        this.mass           = mass
        this.position       = position,
        this.velocity       = velocity,
        this.is_immovable   = is_immovable
        this.is_player      = is_player
    }

    add_force(vector) {
        Vector.add(this.velocity, vector)
    }

    update() {
        this.position.x += this.velocity.x
        this.position.y += this.velocity.y
    }

    static collide(current, target) {
        if(current.is_immovable) { return }

        let x_diff = current.position.x - target.position.x
        let y_diff = current.position.y - target.position.y

        let is_x =  Math.abs(x_diff / (current.width - target.width))
                >   Math.abs(y_diff / (current.height - target.height))

        let x_overlap = 0
        let y_overlap = 0

        if(x_diff > 0)  {
            x_overlap = (target.position.x + target.width / 2)
                    -   (current.position.x - current.width / 2)
        } else {
            x_overlap = (target.position.x - target.width / 2)
                    -   (current.position.x + current.width / 2)
        }

        if(y_diff > 0)  {
            y_overlap = (target.position.y + target.height / 2)
                    -   (current.position.y - current.height / 2)
        } else {
            y_overlap = (target.position.y - target.height / 2)
                    -   (current.position.y + current.height / 2)
        }

        if(target.is_immovable) {
            if(is_x) {
                current.position.x += x_overlap
                current.velocity.x *= -bounce
            } else {
                current.position.y += y_overlap
                current.velocity.y *= -bounce
            }
        } else {
            if(is_x) {
                current.position.x  += x_overlap
                target.position.x   -= x_overlap
            } else {
                current.position.y  += y_overlap
                target.position.y   -= y_overlap
            }

            let average_x_vel   = (target.velocity.x + current.velocity.x) / 2
            let average_y_vel   = (target.velocity.y + current.velocity.y) / 2

            current.velocity.x  = average_x_vel - current.velocity.x * bounce
            current.velocity.y  = average_y_vel - current.velocity.y * bounce
            target.velocity.x   = average_x_vel + target.velocity.x * bounce
            target.velocity.y   = average_y_vel + target.velocity.y * bounce
        }
    }

    static overlaps(current, target) {
        return  current.position.x - current.width / 2   < target.position.x + target.width / 2
            &&  current.position.x + current.width / 2   > target.position.x - target.width / 2
            &&  current.position.y - current.height / 2  < target.position.y + target.height / 2
            &&  current.position.y + current.height / 2  > target.position.y - target.height / 2
    }
}

function down_raycast(current, distance) {
    for(let target of objects) {
        if(current === target) { continue }

        return (target.position.x - target.width / 2 < current.position.x + current.width / 2
            &&  target.position.x + target.width / 2 > current.position.x - current.width / 2
            &&  target.position.y < current.position.y
            &&  Math.abs(
                    (target.position.y + target.height / 2)
                -   (current.position.y - current.height / 2)
                ) <= distance
        )
    }
    return false
}



function physics_loop() {
    for(current of objects) {
        if(current.is_immovable) { continue }

        let new_vel     = new Vector(current.velocity.x, current.velocity.y)
        let is_grounded = down_raycast(current, grounding_distance)

        if(current.is_player) {
            if(is_grounded) {
                if(moving_left)     { new_vel.x -= move_force }
                if(moving_right)    { new_vel.x += move_force }
                if(jumping) {
                    new_vel.y += jump_force
                    //jumping = false
                }
            }
        }

        new_vel.y -= gravity

        if(is_grounded) {
            new_vel.x -= new_vel.x * friction
        }

        if(new_vel.x < stop_velocity && new_vel.x > -stop_velocity) {
            new_vel.x = 0
        }

        current.velocity = Vector.clamp_magnitude(new_vel, max_velocity)
        current.update()
    }

    for(current of objects) {
        if(current.is_immovable) { continue }

        for(target of objects) {
            if(current === target) { continue }

            if(Rectangle.overlaps(current, target)) {
                console.log("collision")
                Rectangle.collide(current, target)
            }
        }

        current.velocity = Vector.clamp_magnitude(current.velocity, max_velocity)
        current.update()
    }
}

function get_camera_offset(target) {
    let camera_offset   = new Vector(target.position.x, target.position.y)
    let average         = new Vector(0, 0)
    let velocity_offset = new Vector(
        target.velocity.x * camera_offset_multiplier,
        target.velocity.y * camera_offset_multiplier
    )

    camera_offset.x -= canvas.width / 2
    camera_offset.y -= canvas.height / 2

    velocity_offset = Vector.clamp_magnitude(velocity_offset, max_camera_offset)

    if(camera_offset_history.length >= camera_offset_history_length) {
        camera_offset_history.shift()
    }
    camera_offset_history.push(velocity_offset)

    for(let i = 0; i < camera_offset_history.length; i++) {
        let target  = camera_offset_history[i]
        average     = Vector.add(average, target)
    }

    return new Vector(
        camera_offset.x + average.x / camera_offset_history.length,
        camera_offset.y + average.y / camera_offset_history.length
    )
}

function draw() {
    let camera_offset = get_camera_offset(player)

    ctx.fillStyle = "#353535"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "#e3e3e3"

    for(o of objects) {
        ctx.fillRect(
            Math.floor(o.position.x - (o.width / 2) + 0.5 - camera_offset.x),
            Math.floor(canvas.height - o.position.y - (o.height / 2) + 0.5 + camera_offset.y),
            Math.floor(o.width),
            Math.floor(o.height),
        )
    }

    requestAnimationFrame(draw);
}



onkeydown = (e) => {
    e.preventDefault()

    switch(e.key.toLowerCase()) {
        case "w": jumping       = true; break
        case "a": moving_left   = true; break
        case "d": moving_right  = true; break
    }
}

onkeyup = (e) => {
    e.preventDefault()

    switch(e.key.toLowerCase()) {
        case "w": jumping       = false; break
        case "a": moving_left   = false; break
        case "d": moving_right  = false; break
    }
}

ontouchstart = (e) => {
    e.preventDefault()

    last_swipe_x = new Vector(e.touches[0].pageX, e.touches[0].pageY)
}

ontouchmove = (e) => {
    e.preventDefault()

    let swipe = new Vector(e.touches[0].pageX - last_swipe.x, e.touches[0].pageY - last_swipe.y)
    let angle = Math.atan2(swipe.x, swipe.y) / Math.PI // 1, 0

    if(Vector.magnitude(swipe) < swipe_threshold) { return }

    if(angle < 0) {
        if(angle > -1/8)        { jumping = true }
        else if(angle > -3/8)   { jumping = true; moving_left = true }
        else if(angle > -5/8)   { moving_left = true }
        else if angle > -7/8    { moving_left = true; /**/ }
        else                    { /**/ }
    } else {
        if(angle < 1/8)         { jumping = true }
        else if(angle < 3/8)    { jumping = true; moving_right = true }
        else if(angle < 5/8)    { moving_right = true }
        else if angle < 7/8     { moving_right = true; /**/ }
        else                    { /**/ }
    }
}



onload = () => {
    canvas  = document.getElementsByTagName("canvas")[0]
    ctx     = canvas.getContext("2d")

    player  = new Rectangle(16, 16, new Point(0, 8), 1, new Vector(0, 0), false, true)

    objects.push(player)
    objects.push(new Rectangle(250, 10, new Point(0, -5), 0, new Vector(0, 0), true))

    requestAnimationFrame(draw)
    setInterval(physics_loop, fixed_delta_time)
}
