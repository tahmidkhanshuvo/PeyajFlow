import type { SVGProps } from "react";

/**
 * Location pin icon matching the red map marker geometry with circular cutout.
 * Sourced directly from user's map marker design.
 */
export const LOCATION_PIN_PATH =
  "M 153 0 L 176 4 L 189 8 L 199 12 L 207 16 L 214 20 L 220 24 L 226 28 L 231 32 L 235 36 L 239 40 L 243 44 L 247 48 L 250 52 L 253 56 L 256 60 L 259 64 L 262 68 L 264 72 L 266 76 L 268 80 L 270 84 L 271 88 L 273 92 L 274 96 L 276 100 L 277 104 L 278 108 L 279 112 L 279 116 L 280 120 L 280 124 L 281 128 L 281 132 L 281 136 L 281 140 L 281 144 L 281 148 L 281 152 L 281 156 L 280 160 L 280 164 L 279 168 L 279 172 L 278 176 L 277 180 L 276 184 L 275 188 L 274 192 L 273 196 L 272 200 L 271 204 L 270 208 L 269 212 L 267 216 L 266 220 L 264 224 L 263 228 L 261 232 L 259 236 L 257 240 L 256 244 L 254 248 L 252 252 L 250 256 L 248 260 L 245 264 L 243 268 L 241 272 L 239 276 L 237 280 L 234 284 L 232 288 L 229 292 L 227 296 L 224 300 L 221 304 L 219 308 L 216 312 L 213 316 L 210 320 L 207 324 L 204 328 L 201 332 L 198 336 L 195 340 L 192 344 L 188 348 L 185 352 L 182 356 L 178 360 L 175 364 L 171 368 L 168 372 L 164 376 L 160 380 L 157 384 L 153 388 L 149 392 L 145 396 L 141 399 L 136 395 L 132 391 L 128 387 L 125 383 L 121 379 L 117 375 L 113 371 L 110 367 L 106 363 L 103 359 L 100 355 L 96 351 L 93 347 L 90 343 L 86 339 L 83 335 L 80 331 L 77 327 L 74 323 L 71 319 L 68 315 L 66 311 L 63 307 L 60 303 L 57 299 L 55 295 L 52 291 L 50 287 L 47 283 L 45 279 L 43 275 L 40 271 L 38 267 L 36 263 L 34 259 L 32 255 L 30 251 L 28 247 L 26 243 L 24 239 L 22 235 L 21 231 L 19 227 L 18 223 L 16 219 L 15 215 L 13 211 L 12 207 L 11 203 L 9 199 L 8 195 L 7 191 L 6 187 L 6 183 L 5 179 L 4 175 L 3 171 L 3 167 L 2 163 L 2 159 L 1 155 L 1 151 L 1 147 L 1 143 L 1 139 L 1 135 L 1 131 L 1 127 L 2 123 L 2 119 L 3 115 L 4 111 L 5 107 L 6 103 L 7 99 L 8 95 L 10 91 L 11 87 L 13 83 L 15 79 L 17 75 L 19 71 L 21 67 L 24 63 L 26 59 L 29 55 L 32 51 L 36 47 L 39 43 L 43 39 L 48 35 L 52 31 L 58 27 L 63 23 L 70 19 L 77 15 L 86 11 L 96 7 L 110 3 Z M 141 61 A 80 80 0 1 0 141 221 A 80 80 0 1 0 141 61 Z";

export interface LocationIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export function LocationIcon({
  size = 18,
  color = "#E32B2B",
  className = "",
  style,
  "aria-hidden": ariaHidden = true,
  ...props
}: LocationIconProps) {
  const width = size;
  const height =
    typeof size === "number" ? Math.round(size * (400 / 282)) : size;

  return (
    <svg
      viewBox="0 0 282 400"
      width={width}
      height={height}
      className={`location-pin-icon ${className}`.trim()}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        ...style,
      }}
      aria-hidden={ariaHidden}
      {...props}
    >
      <path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d={LOCATION_PIN_PATH}
      />
    </svg>
  );
}
