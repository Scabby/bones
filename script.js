let moving_left         = false
let moving_right        = false
let jumping             = false

let fixed_delta_time    = 16
let gravity             = 0.05
let friction            = 0.1 // 0..1
let bounce              = 0.5 // 0..1
let grounding_distance  = 1
let slack_depth         = 0.01

let move_force          = 0.15
let jump_force          = 1.1
let max_velocity        = 10
let stop_velocity       = 0.11

const objects = []

let max_camera_offset               = 32
let camera_offset_multiplier        = 10
let camera_offset_history_length    = 15
const camera_offset_history         = []

let background_color    = "#353535"
let foreground_color    = "#e3e3e3"

let swipe_threshold         = 30
let delta_swipe_sensitivity = 3

let paused = false



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

    static clamp_axes(vector, magnitude) {
        let change_x    = Math.abs(vector.x) >= magnitude
        let change_y    = Math.abs(vector.y) >= magnitude
        let out_vec     = new Vector(vector.x, vector.y)

        if(change_x) {
            if(vector.x < 0)    { out_vec.x = -magnitude }
            else                { out_vec.x = magnitude }
        }

        if(change_y) {
            if(vector.y < 0)    { out_vec.y = -magnitude }
            else                { out_vec.y = magnitude }
        }

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

    static subtract(vector, other) {
        return new Vector(vector.x - other.x, vector.y - other.y)
    }
}

class Rectangle {
    constructor(
        width           = 1,
        height          = 1,
        x               = 0,
        y               = 0,
        mass            = 1,
        velocity_x      = 0,
        velocity_y      = 0,
        is_immovable    = false,
        is_player       = false
    ) {
        this.width          = width
        this.height         = height
        this.mass           = mass
        this.position       = new Point(x, y),
        this.velocity       = new Vector(velocity_x, velocity_y),
        this.is_immovable   = is_immovable
        this.is_player      = is_player
    }

    add_force(vector) {
        Vector.add(this.velocity, vector)
    }

    move() {
        this.position.x += this.velocity.x
        this.position.y += this.velocity.y
    }

    static collide(current, target) {
        if(current.is_immovable) { return }

        let x_diff = current.position.x - target.position.x
        let y_diff = current.position.y - target.position.y

        let is_x =  Math.abs(x_diff / (current.width + target.width - slack_depth * 4))
                >   Math.abs(y_diff / (current.height + target.height - slack_depth * 4))

        let x_overlap = 0
        let y_overlap = 0

        if(x_diff > 0)  {
            x_overlap = (target.position.x + target.width / 2 - slack_depth)
                    -   (current.position.x - current.width / 2 + slack_depth)
        } else {
            x_overlap = (target.position.x - target.width / 2 + slack_depth)
                    -   (current.position.x + current.width / 2 - slack_depth)
        }

        if(y_diff > 0)  {
            y_overlap = (target.position.y + target.height / 2 - slack_depth)
                    -   (current.position.y - current.height / 2 + slack_depth)
        } else {
            y_overlap = (target.position.y - target.height / 2 + slack_depth)
                    -   (current.position.y + current.height / 2 - slack_depth)
        }

        if(target.is_immovable) {
            if(is_x) {
                current.position.x += x_overlap
                //current.velocity.x *= -bounce
                current.velocity.x = 0
            } else {
                current.position.y += y_overlap
                //current.velocity.y *= -bounce
                current.velocity.y = 0
            }
        } else {
            let average = new Point(
                (current.velocity.x + target.velocity.x) / 2,
                (current.velocity.y + target.velocity.y) / 2
            )

            if(is_x) {
                current.position.x  += x_overlap / 2
                target.position.x   -= x_overlap / 2

                current.velocity.x  = average.x
                target.velocity.x   = average.x
            } else {
                current.position.y  += y_overlap / 2
                target.position.y   -= y_overlap / 2

                current.velocity.y  = average.y
                target.velocity.y   = average.y
            }

            //let c_inv_mass  = 1 / current.mass
            //let t_inv_mass  = 1 / target.mass
            // * (c_inv_mass / (c_inv_mass + t_inv_mass))
            // * (c_inv_mass / (c_inv_mass + t_inv_mass))
            // * (t_inv_mass / (c_inv_mass + t_inv_mass))
            // * (t_inv_mass / (c_inv_mass + t_inv_mass))
        }
    }

    static overlaps(current, target) {
        return  current.position.x  - current.width / 2     + slack_depth
            <   target.position.x   + target.width / 2      - slack_depth
            &&  current.position.x  + current.width / 2     - slack_depth
            >   target.position.x   - target.width / 2      + slack_depth
            &&  current.position.y  - current.height / 2    + slack_depth
            <   target.position.y   + target.height / 2     - slack_depth
            &&  current.position.y  + current.height / 2    - slack_depth
            >   target.position.y   - target.height / 2     + slack_depth
    }
}

function down_raycast(current, distance) {
    for(const target of objects) {
        if(current === target) { continue }

        if(     current.position.x - current.width / 2
            <   target.position.x + target.width / 2
            &&  current.position.x + current.width / 2
            >   target.position.x - target.width / 2
            &&  current.position.y > target.position.y
            &&  Math.abs(
                    (target.position.y + target.height / 2)
                -   (current.position.y - current.height / 2)
                ) <= distance
        ) {
            return true
        }
    }
    return false
}



function physics_loop() {
    if(paused) { return }
    
    for(const current of objects) {
        if(current.is_immovable) { continue }

        let new_vel     = new Vector(current.velocity.x, current.velocity.y)
        let is_grounded = down_raycast(current, grounding_distance)

        if(current.is_player) {
            if(is_grounded) {
                if(moving_left)     { new_vel.x -= move_force }
                if(moving_right)    { new_vel.x += move_force }
                if(jumping)         { new_vel.y = jump_force }
            }
        }

        if(is_grounded) {
            new_vel.x -= new_vel.x * friction

            if(new_vel.y < stop_velocity && new_vel.y > -stop_velocity) {
                new_vel.y = 0
                current.position.y = Math.round(current.position.y)
            }

            if(new_vel.x < stop_velocity && new_vel.x > -stop_velocity) {
                new_vel.x = 0
                current.position.x = Math.round(current.position.x)
            }
        } else {
            new_vel.y -= gravity
        }

        current.velocity = Vector.clamp_axes(new_vel, max_velocity)
    }

    for(const current of objects) {
        if(current.is_immovable) { continue }

        for(const target of objects) {
            if(current === target) { continue }

            if(Rectangle.overlaps(current, target)) {
                Rectangle.collide(current, target)
            }
        }

        current.velocity = Vector.clamp_axes(current.velocity, max_velocity)
        current.move()
    }

    current_camera_offset = get_camera_offset(player)
}



function get_camera_offset(target) {
    let camera_offset = new Vector(
        target.position.x - canvas.width / 2,
        target.position.y - canvas.height / 2
    )
    
    let velocity_offset = Vector.clamp_axes(
        new Vector(
            target.velocity.x * camera_offset_multiplier,
            target.velocity.y * camera_offset_multiplier
        ), max_camera_offset
    )
    
    let average = new Vector(0, 0)

    while(camera_offset_history.length >= camera_offset_history_length) {
        camera_offset_history.pop()
    }
    camera_offset_history.unshift(velocity_offset)

    for(let i = 0; i < camera_offset_history.length; i++) {
        average = Vector.add(average, camera_offset_history[i])
    }

    return new Vector(
        camera_offset.x + average.x / camera_offset_history.length,
        camera_offset.y + average.y / camera_offset_history.length
    )
}

function draw() {
    ctx.fillStyle = background_color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = foreground_color

    for(const o of objects) {
        ctx.fillRect(
            Math.floor(
                    o.position.x
                -   (o.width / 2)
                -   current_camera_offset.x
            ),
            Math.floor(
                    canvas.height
                -   o.position.y
                -   (o.height / 2)
                +   current_camera_offset.y
            ),
            Math.floor(o.width),
            Math.floor(o.height),
        )
    }

    requestAnimationFrame(draw)
}



onkeydown = (e) => {
    let is_ctrl     = navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey
    let is_resize   = is_ctrl && (
            e.key == "-"
        ||  e.key == "_"
        ||  e.key == "="
        ||  e.key == "+"
    )

    if(is_resize)   { return }
    else            { e.preventDefault() }

    switch(e.key.toLowerCase()) {
        case "escape"   : paused        = !paused; break
        case "w"        : jumping       = true; break
        case "a"        : moving_left   = true; break
        case "d"        : moving_right  = true
    }
}

onkeyup = (e) => {
    e.preventDefault()

    switch(e.key.toLowerCase()) {
        case "w": jumping       = false; break
        case "a": moving_left   = false; break
        case "d": moving_right  = false
    }
}

document.addEventListener("touchstart", (e) => {
    e.preventDefault()

    last_swipe = new Vector(e.touches[0].pageX, e.touches[0].pageY)
}, { passive: false } )

document.addEventListener("touchmove", (e) => {
    e.preventDefault()

    let swipe       = new Vector(e.touches[0].pageX, e.touches[0].pageY)
    let distance    = Vector.subtract(swipe, last_swipe)
    let angle       = Math.atan2(distance.x, distance.y * delta_swipe_sensitivity) / Math.PI

    last_swipe.y    = swipe.y // jumps are determined by dy
    jumping         = false
    moving_left     = false
    moving_right    = false

    if(Vector.magnitude(distance) < swipe_threshold) { return }

    if(angle < 0) {
        if(angle > -1/8)        { /**/ }
        else if(angle > -3/8)   { moving_left = true; /**/}
        else if(angle > -5/8)   { moving_left = true }
        else if(angle > -7/8)   { jumping = true; moving_left = true }
        else                    { jumping = true }
    } else {
        if(angle < 1/8)         { /**/ }
        else if(angle < 3/8)    { moving_right = true; /**/ }
        else if(angle < 5/8)    { moving_right = true }
        else if(angle < 7/8)    { jumping = true; moving_right = true }
        else                    { jumping = true }
    }

}, { passive: false } )

document.addEventListener("touchend", (e) => {
    e.preventDefault()

    last_swipe      = null
    jumping         = false
    moving_right    = false
    moving_left     = false
}, { passive: false } )



onload = () => {
    canvas  = document.getElementsByTagName("canvas")[0]
    ctx     = canvas.getContext("2d")

    player  = new Rectangle(16, 16, 0, 8, 1, 0, 0, false, true)

    current_camera_offset = get_camera_offset(player)

    objects.push(player)
    objects.push(new Rectangle(250, 10, 0, -5, 0, 0, 0, true))
    objects.push(new Rectangle(250, 10, 0, 100, 0, 0, 0, true))
    objects.push(new Rectangle(10, 20, 50, 10))
    objects.push(new Rectangle(30, 10, -80, 5))
    objects.push(new Rectangle(10, 10, 0, 100))

    requestAnimationFrame(draw)
    setInterval(physics_loop, fixed_delta_time)
}
