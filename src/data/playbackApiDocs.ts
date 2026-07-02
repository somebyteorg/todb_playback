import type { Component } from 'vue'
import { Database, FileJson, Search, UserCheck, Workflow } from '@lucide/vue'
import { markerTypeOptions } from '@/utils/format'

export interface DocValue {
  value: string
  label: string
  detail?: string
}

export interface WorkflowStep {
  id: string
  title: string
  endpoint: string
  detail: string
}

export interface StatusCodeDoc {
  code: string
  title: string
  detail: string
  example?: string
}

export interface EndpointParam {
  name: string
  type: string
  description: string
  values?: DocValue[]
}

export interface EndpointResponseEnum {
  field: string
  path: string
  description: string
  values: DocValue[]
}

export interface EndpointDoc {
  id: string
  number: string
  title: string
  path: string
  icon: Component
  accentClass: string
  description: string
  params: EndpointParam[]
  responseEnums?: EndpointResponseEnum[]
  requestCode: string
  responseStatus: string
  responseCode: string
  notes: string[]
}

export const playbackApiBaseUrl = 'https://playback.theotherdb.org/api'
export const playbackPostmanUrl = 'https://www.postman.com/somebyteorg/todb'

export const quickStartCode = [`curl -X POST '${playbackApiBaseUrl}/user/info' \\`, `  -H 'Content-Type: application/json' \\`, `  -H 'Authorization: Bearer [token]'`].join('\n')

export const workflowSteps = [
  {
    id: '1.1',
    title: '解析作品 ID',
    endpoint: 'POST /ids',
    detail: '外部平台的 ID 和 TODB 数据不一定刚好对上，先查一次对应关系，拿到后续接口使用的 todbv_id。',
  },
  {
    id: '2.1',
    title: '选择视频版本',
    endpoint: 'POST /version',
    detail: '同一个内容可能有默认版、去广告版、导演剪辑版等，时长和标记点都可能不同，所以要先确定版本。',
  },
  {
    id: '2.2',
    title: '拉取元数据',
    endpoint: 'POST /metadata',
    detail: '版本确定后，便可拿到这个版本对应的元数据了。',
  },
] satisfies WorkflowStep[]

export const statusCodes: StatusCodeDoc[] = [
  {
    code: '401',
    title: '未登录',
    detail: '没有传密钥，或 Authorization: Bearer [token] 不正确。',
  },
  {
    code: '422',
    title: '验证问题',
    detail: '字段类型、枚举值或必填参数不符合要求。',
    example: '{"message":"已选的属性 platform 无效。"}',
  },
  {
    code: '404',
    title: '未找到资源',
    detail: '没有找到对应作品、版本或资源。',
  },
]

export const endpoints: EndpointDoc[] = [
  {
    id: 'endpoint-1-1',
    number: '1.1',
    title: '通过第三方 ID 获取 todbv ID',
    path: '/ids',
    icon: Database,
    accentClass: 'bg-teal-500',
    description: '把第三方平台的资源 ID 映射为 TODB 内部 ID。',
    params: [
      {
        name: 'platform',
        type: 'string',
        description: '第三方平台类型',
        values: [
          { value: 'tmdb_id_tv', label: 'TMDB 剧集' },
          { value: 'tmdb_id_movie', label: 'TMDB 电影' },
        ],
      },
      { name: 'value', type: 'number|string', description: '第三方平台 ID，例如 TMDB ID' },
    ],
    requestCode: `{
  "platform": "tmdb_id_movie",
  "value": 238
}`,
    responseStatus: '200 OK',
    responseCode: `{
  "todbv_id": 1000
}`,
    notes: ['拿到 todbv_id 后继续调用 2.1。', 'TODB 无数据时候会返回404'],
  },
  {
    id: 'endpoint-2-1',
    number: '2.1',
    title: '获取视频元数据版本',
    path: '/version',
    icon: Workflow,
    accentClass: 'bg-sky-500',
    description: '查询某个作品下可用的版本。剧集类作品建议带上季数和集数，直接定位到需要的版本。',
    params: [
      { name: 'todbv_id', type: 'number', description: '由 1.1 返回的 PlayBack 作品 ID' },
      { name: 'season_number', type: 'number|null', description: '季数；电影或不确定时传 null' },
      { name: 'episode_number', type: 'number|null', description: '集数；电影或不确定时传 null' },
      { name: 'page', type: 'number|null', description: '页码' },
      { name: 'page_size', type: 'number|null', description: '每页数量，1 到 100' },
    ],
    requestCode: `{
  "todbv_id": 1000,
  "season_number": 1
}`,
    responseStatus: '200 OK',
    responseCode: `{
  "page": 1,
  "page_size": 15,
  "has_more": false,
  "items": [
    {
      // 版本ID
      "version_id": 1007,
      // 版本名称
      "version_name": "默认",
      // 版本名称
      "version_description": null,
      // 版本时常 秒
      "version_runtime": 4320,
      // TODB 季ID
      "season_id": 1000,
      // 季名称
      "season_title": "第 1 季",
      // 季数
      "season_number": 1,
      // TODB 集ID
      "episode_id": 1001,
      // 集名称
      "episode_title": "你要为了一个虚名而嫁给我？",
      // 集数
      "episode_number": 2
    }
  ]
}`,
    notes: ['如果是电影类型 season* episode* 返回都是 null', '同一视频可能存在多个版本。'],
  },
  {
    id: 'endpoint-2-2',
    number: '2.2',
    title: '获取视频元数据',
    path: '/metadata',
    icon: FileJson,
    accentClass: 'bg-violet-500',
    description: '按 version_id 获取版本元数据。',
    params: [
      { name: 'version_id', type: 'number', description: '由 2.1 返回的版本 ID' },
      {
        name: 'includes',
        type: 'string[]',
        description: '需要返回的数据块',
        values: [
          { value: 'version', label: '版本信息', detail: '返回版本名称、描述和时长' },
          { value: 'marker', label: '时间轴标记', detail: '返回片头、片尾、章节、广告等时间段' },
          { value: 'sprite', label: '雪碧图规则', detail: '返回预览图切片间隔和图片地址' },
        ],
      },
    ],
    responseEnums: [
      {
        field: 'marker_type',
        path: 'marker[].marker_type',
        description: '用于标识时间轴标记的类型。',
        values: markerTypeOptions.map(({ value, label }) => ({
          value,
          label,
        })),
      },
    ],
    requestCode: `{
  "version_id": 1012,
  "includes": ["marker", "sprite"]
}`,
    responseStatus: '200 OK',
    responseCode: `{
   // 版本信息
  "version": {
    "version_id": 1012,
    "version_name": "默认版本",
    "version_description": null,
    "version_runtime": 60000
  },
  // 时间轴标记 信息
  "marker": [
    {
      // 标记ID 
      "marker_id": 1141,
      // 标记类型
      "marker_type": "intro",
      // 标记语言
      "marker_language": null,
      // 标题 章节通常会存在
      "title": "片头",
      // 开始时间 秒
      "time_start": 0,
      // 结束时间 秒 像 片头片尾广告等 是个区间 但是章节是某个点 所以没有
      "time_end": 90,
      // 提供此标记的用户头像url
      "user_avatar_url": null,
      // 提供此标记的用户昵称
      "user_nickname": "soa"
    }
  ],
  // 雪碧图
  "sprite": [
    {
      // 雪碧图ID
      "sprite_id": 1010,
      // 单帧的宽度
      "width": 160,
      // 单帧的高度
      "height": 90,
      // 此版本名称
      "name": "预览图规则1",
      // vtt格式的雪碧图地址
      "vtt_url": "http://playback.todb/sprite.vtt",
      "user_avatar_url": null,
      "user_nickname": null
    }
  ]
}`,
    notes: [],
  },
  {
    id: 'endpoint-1-2',
    number: '1.2',
    title: '搜索视频',
    path: '/search',
    icon: Search,
    accentClass: 'bg-amber-500',
    description: '当第三方没有现成平台 ID，或需要做搜索选择时，可以用标题、年份和类型查询作品。',
    params: [
      {
        name: 'video_type',
        type: 'string|null',
        description: '视频类型',
        values: [
          { value: 'tv', label: '剧集' },
          { value: 'movie', label: '电影' },
        ],
      },
      { name: 'title', type: 'string|null', description: '视频名称' },
      { name: 'year', type: 'number|null', description: '上映年份，YYYY' },
      {
        name: 'sort_by',
        type: 'string|null',
        description: '排序字段',
        values: [
          { value: 'vote_average', label: '评分' },
          { value: 'date_air', label: '上映/播出日期' },
          { value: 'updated_at', label: '更新时间' },
        ],
      },
      {
        name: 'sort_order',
        type: 'string|null',
        description: '排序方向',
        values: [
          { value: 'asc', label: '升序' },
          { value: 'desc', label: '降序' },
        ],
      },
      { name: 'page', type: 'number|null', description: '页码' },
      { name: 'page_size', type: 'number|null', description: '每页数量，1 到 100' },
    ],
    requestCode: `{
  "title": "21世纪大君夫人",
  "year": 2026
}`,
    responseStatus: '200 OK',
    responseCode: `{
  "page": 1,
  "page_size": 15,
  "has_more": false,
  "items": [
    {
      // 视频ID 可用作 todbv_id
      "video_id": 1000,
      // 视频类型
      "video_type": "tv",
      // 视频标题
      "video_title": "21世纪大君夫人",
      // 视频简介
      "video_description": "欢迎来到21世纪的韩国...",
      // 视频宣传标语
      "video_tagline": "做好成为大君夫人的准备吧",
      // 原标题
      "origin_title": "21세기 대군부인",
      // 评分 百分制
      "vote_average": 11,
      // 评分总数
      "vote_count": 1,
      // 上映时间
      "date_air": "2026-04-10",
      // 是否成人内容
      "is_adult": false,
      // 封面图url
      "image_poster_url": "https://image.todb/xxxxx"
    }
  ]
}`,
    notes: [],
  },
  {
    id: 'endpoint-3-1',
    number: '3.1',
    title: '获取用户信息',
    path: '/user/info',
    icon: UserCheck,
    accentClass: 'bg-rose-500',
    description: '验证用户填写的 播放密钥 是否可用。',
    params: [],
    requestCode: `{}`,
    responseStatus: '200 OK',
    responseCode: `{
  // 播放密钥ID
  "key_id": 10,
  // 用户头像 url
  "avatar": null,
  // 用户昵称
  "nickname": null,
  // 是否开启了成人模式内容显示
  "show_adult": true
}`,
    notes: ['如果密钥错误时会返回 401。'],
  },
]
