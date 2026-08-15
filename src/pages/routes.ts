import { index, layout, prefix, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  index('./home/page.tsx'),
  route('about', './about/page.tsx'),
  layout('../components/MainLayout.tsx', [
    route('songs', './songs/page.tsx'),
    ...prefix('training', [
      route('phrases', './training/phrases/page.tsx'),
      route('phrases', './training/speed/page.tsx'),
    ]),
  ]),
  route('studio', './studio/page.tsx'),
  route('play', './play/page.tsx'),
  route('freeplay', './freeplay/page.tsx'),
] satisfies RouteConfig
