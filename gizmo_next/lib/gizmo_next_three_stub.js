/* gizmo_next_three_stub.js: a small stand-in for THREE r128, for tests that run with no headset and no real three.js.
   Enough for markers and oriented-box maths: Vector3, Vector2, Quaternion, Euler, Matrix4, Color, Object3D, Group, Scene, Mesh, LineSegments, Points,
   the simple geometries and materials, CanvasTexture, and a Raycaster that tests boxes and spheres only.
   Test use only. It does not render anything. In a browser it sets window.THREE only when there is none. */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  class Vector2 {
    constructor(x, y) { this.x = x || 0; this.y = y || 0; }
    set(x, y) { this.x = x; this.y = y; return this; }
    copy(v) { this.x = v.x; this.y = v.y; return this; }
    clone() { return new Vector2(this.x, this.y); }
  }

  class Vector3 {
    constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    setScalar(s) { this.x = this.y = this.z = s; return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    addVectors(a, b) { this.x = a.x + b.x; this.y = a.y + b.y; this.z = a.z + b.z; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
    cross(v) { var x = this.x, y = this.y, z = this.z; this.x = y * v.z - z * v.y; this.y = z * v.x - x * v.z; this.z = x * v.y - y * v.x; return this; }
    lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
    length() { return Math.sqrt(this.lengthSq()); }
    normalize() { var l = this.length() || 1; return this.multiplyScalar(1 / l); }
    distanceTo(v) { return Math.sqrt(this.distanceToSquared(v)); }
    distanceToSquared(v) { var dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z; return dx * dx + dy * dy + dz * dz; }
    lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
    equals(v) { return this.x === v.x && this.y === v.y && this.z === v.z; }
    toArray(a, o) { a = a || []; o = o || 0; a[o] = this.x; a[o + 1] = this.y; a[o + 2] = this.z; return a; }
    fromArray(a, o) { o = o || 0; this.x = a[o]; this.y = a[o + 1]; this.z = a[o + 2]; return this; }
    applyQuaternion(q) {
      var x = this.x, y = this.y, z = this.z, qx = q.x, qy = q.y, qz = q.z, qw = q.w;
      var ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
      this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
      this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
      this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
      return this;
    }
    applyAxisAngle(axis, angle) { return this.applyQuaternion(new Quaternion().setFromAxisAngle(axis, angle)); }
    applyMatrix4(m) {
      var x = this.x, y = this.y, z = this.z, e = m.elements;
      var w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
      this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
      this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
      this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
      return this;
    }
    transformDirection(m) {
      var x = this.x, y = this.y, z = this.z, e = m.elements;
      this.x = e[0] * x + e[4] * y + e[8] * z; this.y = e[1] * x + e[5] * y + e[9] * z; this.z = e[2] * x + e[6] * y + e[10] * z;
      return this.normalize();
    }
  }

  class Euler {
    constructor(x, y, z, order) { this._x = x || 0; this._y = y || 0; this._z = z || 0; this._order = order || 'XYZ'; this._onChange = function () {}; }
    get x() { return this._x; } set x(v) { this._x = v; this._onChange(); }
    get y() { return this._y; } set y(v) { this._y = v; this._onChange(); }
    get z() { return this._z; } set z(v) { this._z = v; this._onChange(); }
    get order() { return this._order; } set order(v) { this._order = v; this._onChange(); }
    set(x, y, z, order) { this._x = x; this._y = y; this._z = z; this._order = order || this._order; this._onChange(); return this; }
    copy(e) { this._x = e._x; this._y = e._y; this._z = e._z; this._order = e._order; this._onChange(); return this; }
    clone() { return new Euler(this._x, this._y, this._z, this._order); }
    onChange(fn) { this._onChange = fn; return this; }
    setFromRotationMatrix(m, order, update) {
      var te = m.elements, m11 = te[0], m12 = te[4], m13 = te[8], m21 = te[1], m22 = te[5], m23 = te[9], m31 = te[2], m32 = te[6], m33 = te[10];
      order = order || this._order;
      if (order === 'YXZ') {
        this._x = Math.asin(-clamp(m23, -1, 1));
        if (Math.abs(m23) < 0.9999999) { this._y = Math.atan2(m13, m33); this._z = Math.atan2(m21, m22); } else { this._y = Math.atan2(-m31, m11); this._z = 0; }
      } else {
        order = 'XYZ';
        this._y = Math.asin(clamp(m13, -1, 1));
        if (Math.abs(m13) < 0.9999999) { this._x = Math.atan2(-m23, m33); this._z = Math.atan2(-m12, m11); } else { this._x = Math.atan2(m32, m22); this._z = 0; }
      }
      this._order = order;
      if (update !== false) this._onChange();
      return this;
    }
    setFromQuaternion(q, order, update) { return this.setFromRotationMatrix(new Matrix4().makeRotationFromQuaternion(q), order, update); }
  }

  class Quaternion {
    constructor(x, y, z, w) { this._x = x || 0; this._y = y || 0; this._z = z || 0; this._w = w === undefined ? 1 : w; this._onChange = function () {}; }
    get x() { return this._x; } set x(v) { this._x = v; this._onChange(); }
    get y() { return this._y; } set y(v) { this._y = v; this._onChange(); }
    get z() { return this._z; } set z(v) { this._z = v; this._onChange(); }
    get w() { return this._w; } set w(v) { this._w = v; this._onChange(); }
    set(x, y, z, w) { this._x = x; this._y = y; this._z = z; this._w = w; this._onChange(); return this; }
    copy(q) { this._x = q._x; this._y = q._y; this._z = q._z; this._w = q._w; this._onChange(); return this; }
    clone() { return new Quaternion(this._x, this._y, this._z, this._w); }
    onChange(fn) { this._onChange = fn; return this; }
    length() { return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w); }
    normalize() { var l = this.length(); if (l === 0) { this._x = this._y = this._z = 0; this._w = 1; } else { l = 1 / l; this._x *= l; this._y *= l; this._z *= l; this._w *= l; } this._onChange(); return this; }
    conjugate() { this._x *= -1; this._y *= -1; this._z *= -1; this._onChange(); return this; }
    invert() { return this.conjugate(); }
    setFromAxisAngle(axis, angle) { var h = angle / 2, s = Math.sin(h); this._x = axis.x * s; this._y = axis.y * s; this._z = axis.z * s; this._w = Math.cos(h); this._onChange(); return this; }
    setFromEuler(e, update) {
      var x = e._x, y = e._y, z = e._z, c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
      if (e._order === 'YXZ') {
        this._x = s1 * c2 * c3 + c1 * s2 * s3; this._y = c1 * s2 * c3 - s1 * c2 * s3; this._z = c1 * c2 * s3 - s1 * s2 * c3; this._w = c1 * c2 * c3 + s1 * s2 * s3;
      } else {
        this._x = s1 * c2 * c3 + c1 * s2 * s3; this._y = c1 * s2 * c3 - s1 * c2 * s3; this._z = c1 * c2 * s3 + s1 * s2 * c3; this._w = c1 * c2 * c3 - s1 * s2 * s3;
      }
      if (update !== false) this._onChange();
      return this;
    }
    setFromRotationMatrix(m) {
      var te = m.elements, m11 = te[0], m12 = te[4], m13 = te[8], m21 = te[1], m22 = te[5], m23 = te[9], m31 = te[2], m32 = te[6], m33 = te[10], tr = m11 + m22 + m33, s;
      if (tr > 0) { s = 0.5 / Math.sqrt(tr + 1.0); this._w = 0.25 / s; this._x = (m32 - m23) * s; this._y = (m13 - m31) * s; this._z = (m21 - m12) * s; }
      else if (m11 > m22 && m11 > m33) { s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33); this._w = (m32 - m23) / s; this._x = 0.25 * s; this._y = (m12 + m21) / s; this._z = (m13 + m31) / s; }
      else if (m22 > m33) { s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33); this._w = (m13 - m31) / s; this._x = (m12 + m21) / s; this._y = 0.25 * s; this._z = (m23 + m32) / s; }
      else { s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22); this._w = (m21 - m12) / s; this._x = (m13 + m31) / s; this._y = (m23 + m32) / s; this._z = 0.25 * s; }
      this._onChange();
      return this;
    }
    multiply(q) { return this.multiplyQuaternions(this, q); }
    multiplyQuaternions(a, b) {
      var qax = a._x, qay = a._y, qaz = a._z, qaw = a._w, qbx = b._x, qby = b._y, qbz = b._z, qbw = b._w;
      this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
      this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
      this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
      this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
      this._onChange();
      return this;
    }
  }

  class Matrix4 {
    constructor() { this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
    identity() { this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; return this; }
    copy(m) { this.elements = m.elements.slice(); return this; }
    clone() { return new Matrix4().copy(this); }
    compose(p, q, s) {
      var te = this.elements, x = q.x, y = q.y, z = q.z, w = q.w, x2 = x + x, y2 = y + y, z2 = z + z;
      var xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2, sx = s.x, sy = s.y, sz = s.z;
      te[0] = (1 - (yy + zz)) * sx; te[1] = (xy + wz) * sx; te[2] = (xz - wy) * sx; te[3] = 0;
      te[4] = (xy - wz) * sy; te[5] = (1 - (xx + zz)) * sy; te[6] = (yz + wx) * sy; te[7] = 0;
      te[8] = (xz + wy) * sz; te[9] = (yz - wx) * sz; te[10] = (1 - (xx + yy)) * sz; te[11] = 0;
      te[12] = p.x; te[13] = p.y; te[14] = p.z; te[15] = 1;
      return this;
    }
    decompose(position, quaternion, scale) {
      var te = this.elements, sx = Math.hypot(te[0], te[1], te[2]), sy = Math.hypot(te[4], te[5], te[6]), sz = Math.hypot(te[8], te[9], te[10]);
      if (this.determinant() < 0) sx = -sx;
      position.x = te[12]; position.y = te[13]; position.z = te[14];
      var r = new Matrix4().copy(this), re = r.elements, isx = 1 / sx, isy = 1 / sy, isz = 1 / sz;
      re[0] *= isx; re[1] *= isx; re[2] *= isx; re[4] *= isy; re[5] *= isy; re[6] *= isy; re[8] *= isz; re[9] *= isz; re[10] *= isz;
      quaternion.setFromRotationMatrix(r);
      scale.x = sx; scale.y = sy; scale.z = sz;
      return this;
    }
    makeRotationFromQuaternion(q) { return this.compose(new Vector3(0, 0, 0), q, new Vector3(1, 1, 1)); }
    multiply(m) { return this.multiplyMatrices(this, m); }
    multiplyMatrices(a, b) {
      var ae = a.elements, be = b.elements, out = new Array(16);
      for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
        out[c * 4 + r] = ae[r] * be[c * 4] + ae[4 + r] * be[c * 4 + 1] + ae[8 + r] * be[c * 4 + 2] + ae[12 + r] * be[c * 4 + 3];
      }
      this.elements = out;
      return this;
    }
    determinant() {
      var te = this.elements, n11 = te[0], n21 = te[1], n31 = te[2], n12 = te[4], n22 = te[5], n32 = te[6], n13 = te[8], n23 = te[9], n33 = te[10];
      return n11 * (n22 * n33 - n23 * n32) - n12 * (n21 * n33 - n23 * n31) + n13 * (n21 * n32 - n22 * n31);
    }
    invert() {
      var te = this.elements, n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3], n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7], n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11], n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15];
      var t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
      var t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
      var t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
      var t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
      var det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
      if (det === 0) return this.identity();
      var d = 1 / det;
      te[0] = t11 * d;
      te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * d;
      te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * d;
      te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * d;
      te[4] = t12 * d;
      te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * d;
      te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * d;
      te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * d;
      te[8] = t13 * d;
      te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * d;
      te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * d;
      te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * d;
      te[12] = t14 * d;
      te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * d;
      te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * d;
      te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * d;
      return this;
    }
  }

  class Color {
    constructor(c) { this.r = 1; this.g = 1; this.b = 1; if (c !== undefined) this.set(c); }
    set(c) {
      if (c && typeof c === 'object' && 'r' in c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
      if (typeof c === 'string') { var s = c.replace('#', ''); if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]; c = parseInt(s, 16); if (!isFinite(c)) c = 0xffffff; }
      c = Math.floor(c || 0);
      this.r = ((c >> 16) & 255) / 255; this.g = ((c >> 8) & 255) / 255; this.b = (c & 255) / 255;
      return this;
    }
    copy(c) { return this.set(c); }
    clone() { return new Color(this); }
    getHex() { return (Math.round(this.r * 255) << 16) | (Math.round(this.g * 255) << 8) | Math.round(this.b * 255); }
    getHexString() { return ('000000' + this.getHex().toString(16)).slice(-6); }
  }

  class Object3D {
    constructor() {
      this.type = 'Object3D'; this.name = ''; this.parent = null; this.children = [];
      this.position = new Vector3(); this.rotation = new Euler(); this.quaternion = new Quaternion(); this.scale = new Vector3(1, 1, 1);
      this.matrix = new Matrix4(); this.matrixWorld = new Matrix4();
      this.visible = true; this.userData = {}; this.renderOrder = 0; this.frustumCulled = true;
      var self = this;
      this.rotation.onChange(function () { self.quaternion.setFromEuler(self.rotation, false); });
      this.quaternion.onChange(function () { self.rotation.setFromQuaternion(self.quaternion, undefined, false); });
    }
    add() {
      for (var i = 0; i < arguments.length; i++) {
        var o = arguments[i];
        if (!o || o === this) continue;
        if (o.parent) o.parent.remove(o);
        o.parent = this; this.children.push(o);
      }
      return this;
    }
    remove(o) { var i = this.children.indexOf(o); if (i >= 0) { o.parent = null; this.children.splice(i, 1); } return this; }
    traverse(fn) { fn(this); for (var i = 0; i < this.children.length; i++) this.children[i].traverse(fn); }
    updateMatrix() { this.matrix.compose(this.position, this.quaternion, this.scale); }
    updateMatrixWorld() {
      this.updateMatrix();
      if (this.parent) this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix); else this.matrixWorld.copy(this.matrix);
      for (var i = 0; i < this.children.length; i++) this.children[i].updateMatrixWorld(true);
    }
    updateWorldMatrix(up) {
      if (up && this.parent) this.parent.updateWorldMatrix(true);
      this.updateMatrix();
      if (this.parent) this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix); else this.matrixWorld.copy(this.matrix);
    }
    worldToLocal(v) { this.updateWorldMatrix(true); return v.applyMatrix4(this.matrixWorld.clone().invert()); }
    localToWorld(v) { this.updateWorldMatrix(true); return v.applyMatrix4(this.matrixWorld); }
    getWorldPosition(t) { this.updateWorldMatrix(true); return (t || new Vector3()).set(this.matrixWorld.elements[12], this.matrixWorld.elements[13], this.matrixWorld.elements[14]); }
    getObjectByName(n) { var f = null; this.traverse(function (o) { if (!f && o.name === n) f = o; }); return f; }
    raycast() {}
  }
  class Group extends Object3D { constructor() { super(); this.type = 'Group'; this.isGroup = true; } }
  class Scene extends Object3D { constructor() { super(); this.type = 'Scene'; this.isScene = true; } }

  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array ? Math.floor(array.length / itemSize) : 0; this.needsUpdate = false; this.isBufferAttribute = true; } }
  class BufferGeometry {
    constructor() { this.type = 'BufferGeometry'; this.parameters = {}; this.disposed = false; this.attributes = {}; this.index = null; this.drawRange = { start: 0, count: Infinity }; }
    setAttribute(n, a) { this.attributes[n] = a; return this; }
    getAttribute(n) { return this.attributes[n]; }
    setIndex(a) { this.index = a; return this; }
    setDrawRange(s, c) { this.drawRange = { start: s, count: c }; }
    dispose() { this.disposed = true; }
  }
  function geo(type, names) {
    return class extends BufferGeometry {
      constructor() {
        super(); this.type = type;
        var a = arguments; for (var i = 0; i < names.length; i++) this.parameters[names[i]] = a[i];
      }
    };
  }
  var BoxGeometry = geo('BoxGeometry', ['width', 'height', 'depth']);
  var SphereGeometry = geo('SphereGeometry', ['radius', 'widthSegments', 'heightSegments']);
  var CircleGeometry = geo('CircleGeometry', ['radius', 'segments']);
  var ConeGeometry = geo('ConeGeometry', ['radius', 'height', 'radialSegments']);
  var CylinderGeometry = geo('CylinderGeometry', ['radiusTop', 'radiusBottom', 'height', 'radialSegments']);
  var TorusGeometry = geo('TorusGeometry', ['radius', 'tube', 'radialSegments', 'tubularSegments']);
  var RingGeometry = geo('RingGeometry', ['innerRadius', 'outerRadius', 'thetaSegments']);
  var PlaneGeometry = geo('PlaneGeometry', ['width', 'height']);
  class EdgesGeometry extends BufferGeometry { constructor(g) { super(); this.type = 'EdgesGeometry'; this.parameters = { geometry: g }; } }

  class Material {
    constructor(p) {
      this.type = 'Material'; this.disposed = false; this.transparent = false; this.opacity = 1; this.depthWrite = true; this.depthTest = true; this.side = 0; this.map = null;
      this.color = new Color(0xffffff);
      if (p) for (var k in p) { if (k === 'color') this.color = new Color(p.color); else this[k] = p[k]; }
    }
    dispose() { this.disposed = true; }
  }
  class MeshBasicMaterial extends Material { constructor(p) { super(p); this.type = 'MeshBasicMaterial'; } }
  class MeshStandardMaterial extends Material { constructor(p) { super(p); this.type = 'MeshStandardMaterial'; } }
  class LineBasicMaterial extends Material { constructor(p) { super(p); this.type = 'LineBasicMaterial'; } }
  class PointsMaterial extends Material { constructor(p) { super(p); this.type = 'PointsMaterial'; } }
  class SpriteMaterial extends Material { constructor(p) { super(p); this.type = 'SpriteMaterial'; } }

  class Texture { constructor(image) { this.isTexture = true; this.image = image || null; this.repeat = new Vector2(1, 1); this.offset = new Vector2(0, 0); this.needsUpdate = false; this.disposed = false; } dispose() { this.disposed = true; } }
  class CanvasTexture extends Texture { constructor(c) { super(c); this.isCanvasTexture = true; } }

  class Mesh extends Object3D {
    constructor(g, m) { super(); this.type = 'Mesh'; this.isMesh = true; this.geometry = g || new BoxGeometry(1, 1, 1); this.material = m || new MeshBasicMaterial(); }
    raycast(rc, out) {
      var p = this.geometry && this.geometry.parameters, t = this.geometry && this.geometry.type;
      if (t !== 'BoxGeometry' && t !== 'SphereGeometry') return;
      this.updateWorldMatrix(true);
      var inv = this.matrixWorld.clone().invert();
      var o = rc.ray.origin.clone().applyMatrix4(inv), d = rc.ray.direction.clone().transformDirection(inv), th = null;
      var dl = d.length();
      if (t === 'SphereGeometry') {
        var r = p.radius, b = o.dot(d), c = o.lengthSq() - r * r, disc = b * b - c;
        if (disc >= 0) { var s = Math.sqrt(disc); th = -b - s; if (th < 0) th = -b + s; }
      } else {
        var h = [p.width / 2, p.height / 2, p.depth / 2], oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z], t0 = -Infinity, t1 = Infinity, hit = true;
        for (var i = 0; i < 3; i++) {
          if (Math.abs(dd[i]) < 1e-12) { if (oo[i] < -h[i] || oo[i] > h[i]) { hit = false; break; } continue; }
          var a = (-h[i] - oo[i]) / dd[i], bb = (h[i] - oo[i]) / dd[i];
          if (a > bb) { var tmp = a; a = bb; bb = tmp; }
          t0 = Math.max(t0, a); t1 = Math.min(t1, bb);
          if (t0 > t1) { hit = false; break; }
        }
        if (hit && t1 >= 0) th = t0 >= 0 ? t0 : t1;
      }
      if (th === null || th < 0) return;
      var local = o.clone().addScaledVector(d, th), world = local.applyMatrix4(this.matrixWorld);
      var dist = world.distanceTo(rc.ray.origin);
      if (dist < rc.near || dist > rc.far) return;
      out.push({ distance: dist, point: world, object: this });
      void dl;
    }
  }
  class LineSegments extends Object3D { constructor(g, m) { super(); this.type = 'LineSegments'; this.isLineSegments = true; this.geometry = g; this.material = m; } }
  class Points extends Object3D { constructor(g, m) { super(); this.type = 'Points'; this.isPoints = true; this.geometry = g; this.material = m; } }
  class Sprite extends Object3D { constructor(m) { super(); this.type = 'Sprite'; this.isSprite = true; this.material = m; } }

  class Raycaster {
    constructor(origin, direction, near, far) {
      this.ray = { origin: (origin || new Vector3()).clone(), direction: (direction || new Vector3(0, 0, -1)).clone().normalize() };
      this.near = near || 0; this.far = far === undefined ? Infinity : far;
    }
    set(origin, direction) { this.ray.origin.copy(origin); this.ray.direction.copy(direction).normalize(); return this; }
    intersectObject(obj, recursive, out) {
      out = out || [];
      if (obj && typeof obj.raycast === 'function') obj.raycast(this, out);
      if (recursive !== false && obj && obj.children) for (var i = 0; i < obj.children.length; i++) this.intersectObject(obj.children[i], true, out);
      out.sort(function (a, b) { return a.distance - b.distance; });
      return out;
    }
    intersectObjects(objs, recursive) {
      var out = [];
      for (var i = 0; i < objs.length; i++) this.intersectObject(objs[i], recursive, out);
      out.sort(function (a, b) { return a.distance - b.distance; });
      return out;
    }
  }

  var THREE = {
    REVISION: '128stub', __stub: true, DoubleSide: 2, FrontSide: 0, BackSide: 1, RepeatWrapping: 1000,
    Vector2: Vector2, Vector3: Vector3, Euler: Euler, Quaternion: Quaternion, Matrix4: Matrix4, Color: Color,
    Object3D: Object3D, Group: Group, Scene: Scene, Mesh: Mesh, LineSegments: LineSegments, Points: Points, Sprite: Sprite,
    BufferGeometry: BufferGeometry, BufferAttribute: BufferAttribute, AdditiveBlending: 2, BoxGeometry: BoxGeometry, SphereGeometry: SphereGeometry, CircleGeometry: CircleGeometry, ConeGeometry: ConeGeometry,
    CylinderGeometry: CylinderGeometry, TorusGeometry: TorusGeometry, RingGeometry: RingGeometry, PlaneGeometry: PlaneGeometry, EdgesGeometry: EdgesGeometry,
    Material: Material, MeshBasicMaterial: MeshBasicMaterial, MeshStandardMaterial: MeshStandardMaterial, LineBasicMaterial: LineBasicMaterial,
    PointsMaterial: PointsMaterial, SpriteMaterial: SpriteMaterial, Texture: Texture, CanvasTexture: CanvasTexture, Raycaster: Raycaster
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = THREE;
  if (typeof window !== 'undefined' && !window.THREE) window.THREE = THREE;
  W.__GizmoNextThreeStub = THREE;
})();
