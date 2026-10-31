import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {root,appURL} from '../helpers/paths.mjs';
import {openApp,destination,capture} from '../helpers/app.mjs';
import {decodeRaster,inspectAsset} from '../../tools/game-assets/images.mjs';
import {fingerprint} from '../../tools/game-assets/schema.mjs';
import {reviewPlacement,binding} from '../../tools/game-assets/reviews.mjs';
process.env.SGG_EDITION='game';
const manifestPath='docs/design/game-asset-manifest.json';
const manifestBytes=await fs.readFile(path.join(root,manifestPath));
const manifest=JSON.parse(manifestBytes),assets=[...manifest.assets,...manifest.optionalDerived];
const expectedManifestSha256='9f16eaf6e195f646a2776428dbf187c9dcf1ed48a3e0581b57fd8c4e662f82d5';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const assetById=new Map(assets.map(a=>[a.assetId,a]));
test.beforeAll(()=>{expect(sha(manifestBytes),'static evidence requires unchanged manifest').toBe(expectedManifestSha256);});
const key=face=>face.cardId+':'+face.side;
const slug=id=>id.replaceAll(':','-');
const expectedLayers=['background','rear-equipment','plinth','character','front-equipment','frame','foil','text'];
// Frozen candidate identity, copied from Task37 native-targets.json; controls remain separate.
const targetGroups={
  "VIEW-ALPHA-EXT":`character:ga-1180Y:front
character:ga-270C:front
character:ga-270D:front
character:ga-270E:front
character:ga-270F:front
character:ga-340H:front
character:ga-340W:front
character:ga-440W:front
character:ga-590Y:front
character:ga-780Y:front
character:ga-980Y:front
character:ga-SEDDQ:front
character:poo-270C:front
character:poo-270D:front
character:poo-270E:front
character:poo-370W:front
character:poo-440W:front
character:poo-590Y:front
character:poo-780Y:front
character:ssial-1470M:front
character:ssial-270C:front
character:ssial-270D:front
character:ssial-270E:front
character:ssial-270F:front
character:ssial-340H:front
character:ssial-340W:front
character:ssial-440W:front
character:ssial-590Y:front
character:ssial-780Y:front
character:ssial-980Y:front
character:wr-CHQ:front
character:wr-CORD:front
character:wr-NHT:front
character:wr-SPR:front
character:wr-SUJ:front
character:wr-SWRH:front
character:wr-SWRY:front
character:wr-VLV:front
item:flange
item:forge
item:iron
item:jominy
scene:collection:foreground
scene:crafting:foreground
scene:garage:foreground
scene:research:foreground
scene:workshop:foreground
thumbnail:ga-1180Y:front
thumbnail:ga-1470H:alt
thumbnail:ga-1470H:front
thumbnail:ga-270C:front
thumbnail:ga-270D:front
thumbnail:ga-270E:front
thumbnail:ga-270F:front
thumbnail:ga-340H:front
thumbnail:ga-340W:front
thumbnail:ga-440W:front
thumbnail:ga-590Y:front
thumbnail:ga-780Y:front
thumbnail:ga-980Y:front
thumbnail:ga-SEDDQ:front
thumbnail:poo-270C:front
thumbnail:poo-270D:front
thumbnail:poo-270E:front
thumbnail:poo-370W:front
thumbnail:poo-440W:front
thumbnail:poo-590Y:front
thumbnail:poo-780Y:front
thumbnail:poo-PHS:alt
thumbnail:poo-PHS:front
thumbnail:ssial-1470M:front
thumbnail:ssial-270C:front
thumbnail:ssial-270D:front
thumbnail:ssial-270E:front
thumbnail:ssial-270F:front
thumbnail:ssial-340H:front
thumbnail:ssial-340W:front
thumbnail:ssial-440W:front
thumbnail:ssial-590Y:front
thumbnail:ssial-780Y:front
thumbnail:ssial-980Y:front
thumbnail:wr-CHQ:front
thumbnail:wr-CORD:front
thumbnail:wr-NHT:front
thumbnail:wr-SPR:front
thumbnail:wr-SUJ:front
thumbnail:wr-SWRH:front
thumbnail:wr-SWRY:front
thumbnail:wr-VLV:front`.split(/\s+/),
  "VIEW-EDGE-EXT":`character:ssial-1180Y:front
character:ssial-SEDDQ:front
character:wr-SWRM:front
draw:coil-pack
draw:seal
frame:special
frame:standard
item:arrow
item:bath
item:dagger
item:glass
item:kettle
item:loupe
item:potion
item:section
item:shield
item:spark
part:apillar
part:arm
part:bearing
part:bolt
part:bpillar
part:bracket
part:brake
part:bumper
part:clutch
part:conrod
part:crank
part:crossm
part:disc
part:dooro
part:fender
part:floor
part:hood
part:impact
part:reinf
part:rim
part:roof
part:roofx
part:seat
part:sidemem
part:sideo
part:sill
part:stabil
part:tank
part:tierod
part:tire
part:trunkin
part:trunko
part:whouse
stage:plinth
thumbnail:eg-SECC:front
thumbnail:qp-1470:front
thumbnail:ssial-1180Y:front
thumbnail:ssial-SEDDQ:front
thumbnail:wr-SWRM:front`.split(/\s+/),
};
const controls=["character:poo-PHS:front","character:poo-PHS:alt","character:ga-1470H:front","character:ga-1470H:alt"];
const targetHashes={"character:ga-1180Y:front":"fe6e1cecfcf90f8840d346307b1785e7826159b9cb9d288bb553177dc06bc2a9","character:ga-270C:front":"8102f971029db7b740093974a6926e3faaa515acec2055739d34236d32f9b5a9","character:ga-270D:front":"56c20f0f8dd1e4224ecf314721a913e92a82fb9fb915d97676e9877f2f89f365","character:ga-270E:front":"c5f67c589ef32de93d6e9f1fe32ca6b631ac877f3eb4b96e68631150e8f9a2ef","character:ga-270F:front":"d106cc8f848346c44dc4e6febafdbf325b6772e21e06c7d6ec95eca6417ac78e","character:ga-340H:front":"7bfcf49c08e093141a66877c69e95afca0fb359ead5f1bb3103e53a802371ca2","character:ga-340W:front":"f4fab6a24c7557ce8ec1e4c736f910e70a72029c9b53bf9d9b1a97a554f33f46","character:ga-440W:front":"7b380e7c188231a40cb1d2f966b82e5a54b5290a39c2a41da2b24f9c86b6ea1c","character:ga-590Y:front":"9be783b594ddeca61cdfab5088e6957387e9a3a5ab6523eff451df6920a30e16","character:ga-780Y:front":"4f1115221be82f8e93e390b44178d29e52de956b89f2e31bd4b81c83ba3f7240","character:ga-980Y:front":"14897c387b22d7181dfd8d3ca96ae188b975b0be675137064b24758e6bdc0164","character:ga-SEDDQ:front":"0ed20374583ba8223e4d65c756dfcccc4a2fb253f560bfceecdf28b68f5954a0","character:poo-270C:front":"de7d1244d0d6e56a847cbd3d3f30f61f33662a24362b4c10beae0d317cdbb826","character:poo-270D:front":"17d17f2341ebc08acf4e703607e48134c339cc9ae007bc1194a82bb2ef2dcc74","character:poo-270E:front":"fc9b754f5a513feede196301dd734c830fa50d17489cff9e6c31e0af2721bc96","character:poo-370W:front":"18da314b103ea54dd66812170c86600f553767104eb0fd9436159a6a252f9b32","character:poo-440W:front":"e2a7d70fa5b8a0c6e67b36c256d880ce327e8a51a9420ba4e265ae36de28a24c","character:poo-590Y:front":"cf2b970670f9cb5bb268528215e25815e008b0f975603d2cf3d3680d50ebc4e1","character:poo-780Y:front":"41060bd4aea933ba95e6e7055480966a885ec48c1b68d85355887d844d943fa6","character:ssial-1180Y:front":"ff9ebded07aaa7e8ea200ac36cbbdfc94e743c988646b9045b26fb5038a18d70","character:ssial-1470M:front":"70e5092018fe78b2d890ef4ebb764caa2d58eba8962146794aec3ff3dd8de3ca","character:ssial-270C:front":"aebee99660fa579026a8c6f47ed9511ad63988c3f5d3fdc87da1f24af43ca14c","character:ssial-270D:front":"89c4b3bb07197b90876e065e849c70c255c6d08e0a766f070e73be1838e6b958","character:ssial-270E:front":"db07abb976ad34a281832dac64dd0d24c84445584f9251b673b3c0edf9d02a8f","character:ssial-270F:front":"0c418430290b14a7834eb9bf8e37a6f7912cf521f92dc1c1d61965663df42011","character:ssial-340H:front":"669b86a955b0b3e8704a7d5835a146e1bfa55dc2d95cf85acd89238279d7d375","character:ssial-340W:front":"8888a70ca8bc8a4df8771e9d73061e26ebf5de38ade21a37fea24169b84e4b19","character:ssial-440W:front":"5867d2c3b18e63160bb6a299bb418498bf37960a9d30d8d3a6e9924bdd910c98","character:ssial-590Y:front":"be0180183ec31138e1c48f71a0080732462c82acfbddac73b6413252a4d7373a","character:ssial-780Y:front":"ad81ee46e0e8ecac1fa1e2a24197d9a2458eec25e596449034f38a4da951f98b","character:ssial-980Y:front":"63f99abb3fbe1b958a5c074b3be0d2bd21cc892b4450afc39aab4bc9ec345b4b","character:ssial-SEDDQ:front":"3f26a0a8497acd906b03c6f3106b1edcee3fe80e1be039c2db0081c087009da2","character:wr-CHQ:front":"b340397d8e9e0f99aeae2377e7ea8b04760afa06f95990d650e474f2c5a32913","character:wr-CORD:front":"6133cc1728d37eb592dfd718d439aacf72b984579d9239772eca17f7742ef54c","character:wr-NHT:front":"af6a87d87b228efea5583d57ec407d72e73502872f4d2208e639d9c008e253b5","character:wr-SPR:front":"425f2973eb4e879a5fe64c8b0b77f03e2d29782e880ae6f677cac591ce6b7000","character:wr-SUJ:front":"c1b6b67acd61a3fed13ec609cb34a067e78295ee86eb7d5f930ff85101e2d627","character:wr-SWRH:front":"e12461ac26ceeccb7e4a448b5969f5b38bc947bd526c6eef9a86406fa890c498","character:wr-SWRM:front":"7f8cc14e5108b06612847c118536d49532f6e0441826eee5c0f370aa32b7ee42","character:wr-SWRY:front":"94757d436942e1a79806e85b404b29512bed6d20f7223608e40f882cf0dddd42","character:wr-VLV:front":"d9d710a3fedd2657291ce2dbe50ffe30e329532ce623857f5498873a1fe0a0a3","draw:coil-pack":"3661b983e33babab10e708bc4bdd665c3506c32fe8b1d57eabb28ee778859a7b","draw:seal":"b150b1af26ecbb50ae1498463ddb9ca4145575199d18971eba85808de8249373","frame:special":"192298314223be24725e56f48e6ddcd0eef0d29192cf3a5b39b7a0b3e3a944c1","frame:standard":"9b3106413e737c332d7232f87da4a54db5830921785d36c4e36192246dc8d6d1","item:arrow":"41eff615155511936e8433e55771fb794092722e787410430cb17c5da1292afb","item:bath":"44c76bb03d7132c004285258cbaf46566afb98a2496372834df746cf94454890","item:dagger":"d8628ded5e15b8114d3750fea961231046ee55b65f284bc7abeee2864394850a","item:flange":"9c70d178f04df012f2a0ab184a34b1aa117b29d628f5e19ffa32409b4a4ff810","item:forge":"6a938d58c03a9c3827528bf8b5a803ee75b29edc1e6a70d28e06da575d407745","item:glass":"81a888442d43f3295aecc08f5bfdb0c378a86e890f51bacb5bb50c5b79795c80","item:iron":"461d835cf0f68e643c20d2030b24f5a6bda2c0ae1926b23947b1e2669f7f7c0c","item:jominy":"42ab4c8d47173fc7112bf6e2a2fcb04ce7bd906735f79ead9d0633d589fc00d6","item:kettle":"9473a86e3249300e224dc016dfff77aa650437398aeb557d3a1f5f37d647d989","item:loupe":"2a2238f355464c1cda90f0111943011026cea4d92b03c8c2be45c66654f1c54e","item:potion":"01e68b77ca4db30ec3c8b605ce754e2a322041b23eaf162b44df9671a48b1be5","item:section":"6b1610e5bd6196ac59e5f7df7940349dd55d339dfde1a4275ecade5164d5f929","item:shield":"3d1f8fe32e87e201ab8cc97249da929f6415b86e4038ae5be5d4c39f4e1582df","item:spark":"b65774b8772c73019523ff9f90e3754d355f5bf34b9f4e34c4f91fc014fb3ddd","part:apillar":"6e4d38063597d7f8e1e67976172744d7168524b23523d8390c80ced460d63673","part:arm":"1e127651774c8f668d250f8c96671451021543d89331e4a92a551b78fbf0b21b","part:bearing":"460b759453eb1675a5910b4a0e072751ecb200554521b21f9aa185973db970b9","part:bolt":"7d858e4b6393b4ec52b779d2f37e96dbeeffec8e11a55850942f90507ed40e76","part:bpillar":"cd5dc59add7795f11aa8a8f929332b3849c40c4b690a10635203fef5e4c310dd","part:bracket":"82caf2145d8f24d759273f9a1e953e9d8cbeee509479bbe7e73902af6bbe03f2","part:brake":"652899e04859d603e17251030f24273b3ae72233d37f36bf75e74e59922297fa","part:bumper":"25edf036add7af936d416ebd205899dbe37a9b1bd3fd5f8b64c9db03bebab8f9","part:clutch":"0c65ab5821aff53961d73e3636a3ef98d8c41239cbedbbbcbfc5c71e9dbfce39","part:conrod":"974d0e90ae65c21022952afb23d98d110377e897706116bb60af69cff269f31b","part:crank":"1a98293efd09c80ab51403f9d7112a8b23b2f362783d544183b80f18e5c6c0df","part:crossm":"8e46b948fd6e6cab7bbb580b40ce8185628f64f4f468be10385e72621e8bc908","part:disc":"7b6f5f456e4b297341e549d963a5de500e5f7f3b4ae20a8c3f39f0028e0818a5","part:dooro":"968f9b355b66fc5dd113f39126af930900eda0dcf53b594b03b5fda194f74c0b","part:fender":"6f24cde7b3b35dd3651006a43208e5c5833500b7e64db79e0ebc729f5a234b99","part:floor":"5a6fc1278220433798627b1b5f620a10a288cccf7d3c5a5fa180b58d20ff1f19","part:hood":"1587122cf51ea4dc25c41f69282d05e6f428691b04d551d6cbb923eed218f7cd","part:impact":"94a4de890cbec55d3f26cb61902b6dcc70553f74cdda51cedd459c37578cfabb","part:reinf":"84577133092b37f07ecd2856a46f7747c2fead8e4f7b790a9c25d483c28d9ae4","part:rim":"859b7cd015149292b888828eb1150a6607e538b5e21c78aa2c1dc99a3c338450","part:roof":"8c6e3354924699b96cb766e0b106c690b75bc93be65de6d5e3dbc2a7892a563d","part:roofx":"feb2aa837332d6a1c8b6273e212c2c6c80365ae27a5f3664e5a6f0ab46c9f803","part:seat":"949f11464d1212118bfa3b69c703ac3f7bde173d4bfecc50011d6ee9fdb2f1e3","part:sidemem":"f1c4b04918a78c5cdf7c9bbbfc2fece82ef531eb74be8b23072f4d76875b1685","part:sideo":"2c6b0393b3a7de122c607f20fb00483e92887090b97ae50911ab3c5b5db87849","part:sill":"057987123055d1f824962432068b5b955b26620a9628884581deba87eaea09cd","part:stabil":"f15e3dc4cf904b4c354e81864153f494ec2335bdabfa4fb60698764d8990598f","part:tank":"6db5f4c5495cecb5a58d149d2c7737377ab93f65a501baa551c9c29ce571b637","part:tierod":"7080dfb65d9c758545a12c767b4473ab281ee21fb07a679493528e30b21ead0d","part:tire":"8d133ebcb898076a8f2b825c309ced1cf4ddc2527de5bfc212f3cbff45e8601b","part:trunkin":"8acff333f74039f04e599f3c1935596780a9186f833ca26cbe3a0fd8e6a7b261","part:trunko":"9c7477b1df395f20c09ca036604add0adc1e85005e20f35c02e6faca3f2794cc","part:whouse":"2d3cc796c208d432c982c9638b0d6daa470eb4da91f0e8df9562620b19d93875","scene:collection:foreground":"1ebe41fd58063f5c703059d2effe0ef98fff84cdaa2b7a15fcd9114b258f4735","scene:crafting:foreground":"82b4db5c0f239bcc7170cee5e07a4df34f8dd0f9be08bdcbbeb7a376660061af","scene:garage:foreground":"ac7d58810ea4748d22e4b063365a537fded688b846d3af524322dd7473136da6","scene:research:foreground":"f022be6512cbbe707c5f43c074df1ddc1a3ed80527a5091a4bd15916a82b28b1","scene:workshop:foreground":"dfa7c159ed5e88e78725c9a273b50e49194e1e457efad731a36ef09ccdc19aec","stage:plinth":"a6f3697a170672bffb40fe1ddeed92a7f2f479d4e06bd5422355fb3abe93d362","thumbnail:eg-SECC:front":"9e2e97b473cb26e4b89d073111f2f97550e309b3dc6732368e67a27fbf8c7aae","thumbnail:ga-1180Y:front":"4f69ff4dd5a28ec783bc61b6bf052ef911eb9ad9f9b39056e70b0b94d11defa5","thumbnail:ga-1470H:alt":"9ab0a19a319ecc5f5c66260d294c829cfe16f6e7d68c2ce0fc847b40c0b9e4a9","thumbnail:ga-1470H:front":"77979b22068aff090ab1268e762e49157043868e03dab045c04ed0cab6179b9e","thumbnail:ga-270C:front":"9c8e5bdc3fdb4e5195afb558f11e76338681743fd82b991cd31d221bb3cea15c","thumbnail:ga-270D:front":"afc794e52f847962ebb33cda7aecfa6a571996237fd89925a035aa7007538b31","thumbnail:ga-270E:front":"4a51f1c0f050686f5f518fd0d4da63136f39097025995182ea295b56591a30e3","thumbnail:ga-270F:front":"bb2a45dee103f0854997e6d1090588a41230ff57f43c51386dc7613e8e47e81d","thumbnail:ga-340H:front":"59f4f4a82bd2043074ab4e6be77514c3ee0e30fa4b4d8ccc2bb36e85cc373e5f","thumbnail:ga-340W:front":"799c30d1031559c847f0d9bca4a72d55b187f96900ca25eb57728654740fdc84","thumbnail:ga-440W:front":"0c95ccc397243a07c4e1534d7a2c0e4ef0e583e656917d533171f64863778fde","thumbnail:ga-590Y:front":"cb89de8154c687a0a078982c4be828a40af9f0b6f5651c81e6c6731fc1577067","thumbnail:ga-780Y:front":"f90679bb942e33b3dee40e6b278a349d05912f320390fbbe7d2bdb2f2f92cdd5","thumbnail:ga-980Y:front":"df463d877356b5226484261a14484c60aed56c750c39259cb6c0458bd30253a4","thumbnail:ga-SEDDQ:front":"1e30a63c17210fc29ce990aee4d105b926104f8717c749df27eb0101bda29d47","thumbnail:poo-270C:front":"b6289e3478bbe3dd21bf566af6b26c535c35900fce9714a7eeb19aeed587feef","thumbnail:poo-270D:front":"26128651da08c671af307812688a46bca381c4819f983fa3d8449eb6bde43126","thumbnail:poo-270E:front":"aa5558b3bcb8109b6892fd824f43116a213fd3d46b8d3ee0e29d676bfe853400","thumbnail:poo-370W:front":"74ba46ccfafc2530d7aaf80e5470ad917a734660042a655ee9c518954beb0535","thumbnail:poo-440W:front":"42a45d9ec41d968069433048dbffe7b38885d0ccfc39856f5f8fc4ccc01ce763","thumbnail:poo-590Y:front":"d81dd460dadc534fba1f0538495133f91cb8b7008181f18828b8b3055027d309","thumbnail:poo-780Y:front":"bb2027bf180cba0183e53d397a39834d9cea1d607a0194a258476b18e577042b","thumbnail:poo-PHS:alt":"3fa7c167908325ed4402ff2f8b5a5d94de3d1e17cc061067935725c5022c3f92","thumbnail:poo-PHS:front":"da1a6064a52adc530313da5491f534b6013c8be2e5e326655b68026043b3494b","thumbnail:qp-1470:front":"afe5bced9147158dd63f42d650837253c398722e2312e74d3f247d7f91a17511","thumbnail:ssial-1180Y:front":"e442fd5d2f66c0fcc23e1c54acb7e06dbb4a8c24454cfef3983c0c997fcc3be7","thumbnail:ssial-1470M:front":"150320ce984670bd5f6e591c44ca3184036ce1e1f871ed3ed6f1dab7a0faa7a3","thumbnail:ssial-270C:front":"b68a8df40a1b4d57033b261e58640355f7d456aded0dc4e5df87150c45ab6837","thumbnail:ssial-270D:front":"9177d0847e62add4d3dc8db01c416ed388a61d1ee7ae7bd6308c10617bc64ee4","thumbnail:ssial-270E:front":"4991a080db911e507912a46b3ae7d92e59dde4f92c7b2c6773336dc1e1a2ca14","thumbnail:ssial-270F:front":"6216150a6eb157507152e40a5e4f04c7c7847ad5868555aaa65915f0c74856fb","thumbnail:ssial-340H:front":"7f9d25139d94d01f126b05ffef2807b6151a4d9bcd48635ba459943332e9cbce","thumbnail:ssial-340W:front":"4e4fb7e09bd4cadd955561bc5081ae29c8a00ad0436a746a23cdbe6afabb8039","thumbnail:ssial-440W:front":"8508a0496fa28ae1beda8f10743e3b0aee0422533d6e9fc27e32f22e6041d536","thumbnail:ssial-590Y:front":"9af8d5c33178de4e2747d9457db9bde77e8b6827f7f08b190d8060795309bd05","thumbnail:ssial-780Y:front":"a06514554957ecf0612309eb98e65181fb0871fa30c2a6ac344eb9b34f741f1b","thumbnail:ssial-980Y:front":"6df158a2c50c798866a615d0edb8090f4032b1040bede03ba2bf75547c98026f","thumbnail:ssial-SEDDQ:front":"e1e738bd7c6d99cbfecadf44bfba8df8b8af1fbfff14ec9d7565aefe76715d54","thumbnail:wr-CHQ:front":"8d80a05b497307bdccc01c78c2e4a696b9f9c1f5ccc7554f2bd35c41988acf01","thumbnail:wr-CORD:front":"e168271d7bfa791cd2e21fa0d66823f97f230b2a875f2bc6e3a9e7d9a5ee3861","thumbnail:wr-NHT:front":"52158ee208df913f4ecb01852b37a4907c9e6e1bba1c250d063593bba97bc83b","thumbnail:wr-SPR:front":"bcdabeedb493e782bacaf244a1974311730e33f7247343b14be071c7ca485988","thumbnail:wr-SUJ:front":"5834c6d447612c21a6888fa14c8cc100f9f96eb4b9984c7031ea6081950855a9","thumbnail:wr-SWRH:front":"8ef6dec853d8c10da26941c63339379ebc7b2c804af100755aa00ea2082f4689","thumbnail:wr-SWRM:front":"14c9feb4135a536750229b27f9bd6318fb64788f66004877762e593d0e61a07d","thumbnail:wr-SWRY:front":"3ddfbcca32099263f82e38ef3d1f8c63b330f3463730ded233285e77e7dfadb4","thumbnail:wr-VLV:front":"80569048403fab3197e99e4cd11a4b1e98a6bd168b08f3ce15d46a19992dcb52","character:poo-PHS:front":"8642c9d1dd095f4b0c90e307b3d71ef1ab4efaf9aac4d8de52af54aa5d2ce279","character:poo-PHS:alt":"988efb704af878f1acbbfcdecfd21955a4ac06586ae71d612bd5ff17c4831347","character:ga-1470H:front":"2d62ecce77355c2c52b27a7704afc54c53250b0064ea38a77e36c4133938a065","character:ga-1470H:alt":"0d0e95092ff79a80d2c74b641cd0705d68c738115f13983dd21fd160b7be2803"};
const candidateIds=Object.values(targetGroups).flat();
const fileCache=new Map();
async function source(relative){if(!fileCache.has(relative))fileCache.set(relative,await fs.readFile(path.join(root,relative)));return fileCache.get(relative);}
async function artifact(info,name,bytes){const file=info.outputPath(name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);return {path:file,sha256:sha(bytes),bytes:bytes.length};}
async function open(page){
 await page.emulateMedia({reducedMotion:'reduce'});const served=await openApp(page,appURL,'qp-owned');
 const mute=page.getByRole('button',{name:'무음으로 계속',exact:true});if(await mute.isVisible())await mute.click();
 const current=await page.evaluate(()=>({edition:GAME_CONFIG.edition,fixture:GAME_CONFIG.syntheticFixture,release:GAME_CONFIG.releaseId,faces:GAME_CONFIG.faces,placements:GAME_CONFIG.placements,assets:GAME_CONFIG.assets}));
 expect(current.edition).toBe('game');expect(current.fixture).toBe(false);expect(current.faces).toEqual(manifest.faces);expect(current.placements).toEqual(manifest.placements);
 for(const row of assets){expect(current.assets[row.assetId]?.sha256,row.assetId).toBe(row.sha256);expect(current.assets[row.assetId].url).toContain('/'+current.release+'/');}
 return {served,current};
}
async function servedAsset(page,row){
 const declared=await page.evaluate(id=>GAME_CONFIG.assets[id],row.assetId);expect(declared.sha256).toBe(row.sha256);
 const response=await page.request.get(new URL(declared.url,appURL).href),bytes=await response.body();expect(response.status()).toBe(200);assertSourceSHA(sha(bytes),row.sha256);expect(sha(await source(row.path))).toBe(row.sha256);
 return {assetId:row.assetId,sourcePath:row.path,sourceSha256:row.sha256,url:response.url(),httpStatus:response.status(),httpBodySha256:sha(bytes),bytes:bytes.length,mime:response.headers()['content-type']};
}
function compareRaster(raw,native){
 expect(native.length).toBe(raw.length);const bands=[[0,0],[1,15],[16,63],[64,127],[128,254],[255,255]].map(([min,max])=>({min,max,pixels:0,rgbDifferentPixels:0,maxRGBDelta:0,alphaDifferentPixels:0,maxAlphaDelta:0,samples:[]}));
 let alphaDifferentPixels=0;
 for(let p=0;p<raw.length;p+=4){const a=raw[p+3],band=bands.find(b=>a>=b.min&&a<=b.max);band.pixels++;let delta=0;for(let c=0;c<3;c++)delta=Math.max(delta,Math.abs(raw[p+c]-native[p+c]));if(delta){band.rgbDifferentPixels++;band.maxRGBDelta=Math.max(band.maxRGBDelta,delta);if(band.samples.length<3)band.samples.push({pixel:p/4,source:Array.from(raw.subarray(p,p+4)),canvas:Array.from(native.subarray(p,p+4))});}const ad=Math.abs(a-native[p+3]);if(ad){alphaDifferentPixels++;band.alphaDifferentPixels++;band.maxAlphaDelta=Math.max(band.maxAlphaDelta,ad);}}
 return {alphaDifferentPixels,bands,note:'Independent FFmpeg raw RGBA versus native Canvas readback. RGB deltas are reported by alpha band; Canvas premultiplication may affect readback. No blanket ±1 tolerance or encoder/root-cause claim.'};
}
async function native(page,row,oracle=null){
 return page.evaluate(async ({row,oracle})=>{
  const raw=oracle?Uint8Array.from(atob(oracle),c=>c.charCodeAt(0)):null;
  const img=new Image();img.src=GAME_CONFIG.assets[row.assetId].url;await img.decode();const w=img.naturalWidth,h=img.naturalHeight;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
  const pixels=ctx.getImageData(0,0,w,h).data,hist=Array(256).fill(0),alpha=new Uint8Array(w*h),samples={transparent:null,fractional:null,edge:null};let border=0;const support={minX:w,minY:h,maxX:-1,maxY:-1};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,a=pixels[i*4+3];hist[a]++;alpha[i]=a;if(!a&&!samples.transparent)samples.transparent={x,y};if(a>0&&a<255&&(!samples.fractional||Math.abs(a-128)<Math.abs(samples.fractional.alpha-128)))samples.fractional={x,y,alpha:a};if(a){support.minX=Math.min(support.minX,x);support.minY=Math.min(support.minY,y);support.maxX=Math.max(support.maxX,x);support.maxY=Math.max(support.maxY,y);if(x===0||y===0||x===w-1||y===h-1)border++;if(!samples.edge&&(a<255||x===0||y===0))samples.edge={x,y};}}
  const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const proofs=[{name:'transparent',png:canvas.toDataURL('image/png')}],composites=[];
  for(const bg of ['light','dark','checker']){
   const c=document.createElement('canvas');c.width=w;c.height=h;const t=c.getContext('2d',{willReadFrequently:true});const expected=(x,y)=>bg==='light'?[246,243,236]:bg==='dark'?[23,40,60]:(Math.floor(x/32)+Math.floor(y/32))%2?[170,170,170]:[255,255,255];
   if(bg==='checker'){for(let y=0;y<h;y+=32)for(let x=0;x<w;x+=32){t.fillStyle=(Math.floor(x/32)+Math.floor(y/32))%2?'#aaa':'#fff';t.fillRect(x,y,32,32);}}else{t.fillStyle=bg==='light'?'#f6f3ec':'#17283c';t.fillRect(0,0,w,h);}t.drawImage(img,0,0);
   const out=t.getImageData(0,0,w,h).data;let checked=0,mismatches=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;if(pixels[p+3]===0){checked++;const e=expected(x,y);if(out[p]!==e[0]||out[p+1]!==e[1]||out[p+2]!==e[2]||out[p+3]!==255)mismatches++;}}
   const bands=[[0,0],[1,15],[16,63],[64,127],[128,254],[255,255]].map(([min,max])=>({min,max,pixels:0,differentPixels:0,maxRGBDelta:0,samples:[]}));if(raw)for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4,a=raw[p+3],band=bands.find(b=>a>=b.min&&a<=b.max),bgRGB=expected(x,y),want=bgRGB.map((v,c)=>Math.round(raw[p+c]*a/255+v*(1-a/255)));band.pixels++;let delta=0;for(let c=0;c<3;c++)delta=Math.max(delta,Math.abs(out[p+c]-want[c]));if(delta){band.differentPixels++;band.maxRGBDelta=Math.max(band.maxRGBDelta,delta);if(band.samples.length<2)band.samples.push({x,y,rawSource:Array.from(raw.slice(p,p+4)),sourceOverExpected:want,native:Array.from(out.slice(p,p+4))});}}composites.push({background:bg,rgbaSha256:await digest(out),alpha0CoordinatesChecked:checked,alpha0BackgroundMismatchPixels:mismatches,sourceOverComparison:raw?bands:null,comparisonNote:'Straight-alpha source-over arithmetic rounded to 8-bit, versus actual browser composite; differences recorded, no unproven blanket RGB tolerance.'});proofs.push({name:bg,png:c.toDataURL('image/png')});
  }
  for(const [name,point] of Object.entries(samples)){if(!point)continue;const size=128,x=Math.max(0,Math.min(w-size,point.x-size/2)),y=Math.max(0,Math.min(h-size,point.y-size/2)),c=document.createElement('canvas');c.width=512;c.height=544;const t=c.getContext('2d');t.fillStyle='#17283c';t.fillRect(0,0,512,544);t.fillStyle='#fff';t.font='14px sans-serif';t.fillText(row.assetId+' '+name+' @ '+point.x+','+point.y,8,20);t.imageSmoothingEnabled=false;t.drawImage(canvas,x,y,Math.min(size,w),Math.min(size,h),0,32,512,512);proofs.push({name:name+'-detail',png:c.toDataURL('image/png'),sourceRect:{x,y,width:Math.min(size,w),height:Math.min(size,h)},sample:{...point,rgba:Array.from(pixels.slice((point.y*w+point.x)*4,(point.y*w+point.x)*4+4))}});}
  let binary='';for(let p=0;p<pixels.length;p+=32768)binary+=String.fromCharCode(...pixels.subarray(p,p+32768));
  return {assetId:row.assetId,currentSrc:img.currentSrc,width:w,height:h,colorSpace:ctx.getContextAttributes?.().colorSpace||'srgb',rgbaSha256:await digest(pixels),alphaSha256:await digest(alpha),alphaHistogram:hist,borderNonzeroAlpha:border,support,samples,composites,proofs,rgbaBase64:btoa(binary)};
 },{row,oracle:oracle?oracle.rgba.toString('base64'):null});
}
for(let start=0;start<candidateIds.length;start+=25)test(`native candidate IDs ${start+1}–${Math.min(start+25,145)} have exact current byte binding`,async({page,browser},info)=>{
 const boot=await open(page),rows=[];const version=spawnSync('ffmpeg',['-version'],{encoding:'utf8',timeout:15000,maxBuffer:32768});expect(version.status).toBe(0);
 for(const id of candidateIds.slice(start,start+25)){
  const row=assetById.get(id);expect(row.sha256).toBe(targetHashes[id]);const http=await servedAsset(page,row),oracle=decodeRaster(await source(row.path)),observed=await native(page,row,oracle);
  expect([observed.width,observed.height]).toEqual([oracle.width,oracle.height]);expect([observed.width,observed.height]).toEqual([row.dimensions.width,row.dimensions.height]);expect(observed.currentSrc).toBe(http.url);
  const compared=compareRaster(oracle.rgba,Buffer.from(observed.rgbaBase64,'base64'));delete observed.rgbaBase64;expect(compared.alphaDifferentPixels).toBe(0);for(const bg of observed.composites)expect(bg.alpha0BackgroundMismatchPixels).toBe(0);
  const proofs=[];for(const proof of observed.proofs){const {png,...metadata}=proof;proofs.push({...metadata,...await artifact(info,slug(id)+'-'+proof.name+'.png',Buffer.from(png.split(',')[1],'base64'))});}delete observed.proofs;
  rows.push({...http,group:Object.entries(targetGroups).find(([,ids])=>ids.includes(id))[0],engine:info.project.name,browserVersion:browser.version(),playwrightVersion:'1.61.1',decoderVersion:version.stdout.split('\n')[0],sourceRGBA:{width:oracle.width,height:oracle.height,sha256:sha(oracle.rgba),inputSha256:row.sha256,colorSpace:'FFmpeg rgba output; no hidden-RGB conclusion from Canvas'},...observed,compared,proofs});
 }
 await capture(info,'native-candidates',{manifestSha256:sha(manifestBytes),boot,candidateNumerator:rows.length,candidateDenominator:145,controlsExcluded:controls,rows,manualVisualApproval:false});
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');await artifact(info,'native-review.html',Buffer.from('<!doctype html><meta charset="utf-8"><style>body{background:#242c33;color:#fff;font:16px sans-serif}img{display:block;max-width:100%;height:auto}section{border-bottom:1px solid #aaa;padding:16px}a{color:#dcc194}</style><h1>Native '+info.project.name+' — preserve natural aspect</h1>'+rows.map(r=>'<section><h2>'+escape(r.assetId)+'</h2><p>'+r.group+' · '+r.httpBodySha256+'</p>'+r.proofs.map(p=>'<h3>'+p.name+'</h3><a href="'+path.basename(p.path)+'"><img src="'+path.basename(p.path)+'"></a>').join('')+'</section>').join('')));
});
test('four prior native controls stay separate from the 145 new candidates',async({page,browser},info)=>{
 await open(page);expect(candidateIds).toHaveLength(145);expect(new Set(candidateIds).size).toBe(145);expect(targetGroups['VIEW-ALPHA-EXT']).toHaveLength(89);expect(targetGroups['VIEW-EDGE-EXT']).toHaveLength(56);expect(controls.filter(id=>candidateIds.includes(id))).toEqual([]);const rows=[];
 for(const id of controls){const row=assetById.get(id);expect(row.sha256).toBe(targetHashes[id]);const http=await servedAsset(page,row),oracle=decodeRaster(await source(row.path)),observed=await native(page,row,oracle),compared=compareRaster(oracle.rgba,Buffer.from(observed.rgbaBase64,'base64'));delete observed.rgbaBase64;const proofs=[];for(const {png,...p} of observed.proofs)proofs.push({...p,...await artifact(info,slug(id)+'-'+p.name+'.png',Buffer.from(png.split(',')[1],'base64'))});delete observed.proofs;expect(compared.alphaDifferentPixels).toBe(0);for(const bg of observed.composites)expect(bg.alpha0BackgroundMismatchPixels).toBe(0);rows.push({...http,...observed,proofs,compared,engine:info.project.name,browserVersion:browser.version(),controlOnly:true});}
 await capture(info,'native-controls',{controlNumerator:4,controlDenominator:4,newCandidateDenominator:145,rows,manualVisualApproval:false});
});
// Measure the currently connected product card; no replacement body, config or standalone renderer.
async function measureCard(card,face,outputWidth=null){
 return card.evaluate(async(element,{face,outputWidth})=>{
  const box=element.getBoundingClientRect(),width=outputWidth||Math.round(box.width),height=Math.round(box.height*width/box.width),sx=width/box.width,sy=height/box.height;
  const canvas=()=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
  const css=node=>{const s=getComputedStyle(node);return {display:s.display,visibility:s.visibility,opacity:s.opacity,transform:s.transform,transformOrigin:s.transformOrigin,zIndex:s.zIndex,objectFit:s.objectFit,objectPosition:s.objectPosition,clipPath:s.clipPath,maskImage:s.maskImage,overflow:s.overflow,backgroundColor:s.backgroundColor,borderRadius:s.borderRadius};};
  const planes=[],images=[],geometry=[];
  for(const img of element.querySelectorAll('img')){
   const holder=img.closest('[data-asset]'),item=img.closest('[data-item]'),layer=img.closest('[data-layer]'),icss=css(img),p=canvas(),ctx=p.getContext('2d',{willReadFrequently:true});
   let x,y,w,h,matrix=[1,0,0,1,0,0],origin=[0,0],opacity=1,visible=true;
   for(let node=img;node&&node!==element.parentElement;node=node.parentElement){const s=getComputedStyle(node);opacity*=Number(s.opacity);visible=visible&&s.display!=='none'&&s.visibility!=='hidden';if(s.maskImage!=='none'||s.clipPath!=='none')throw Error('Unsupported current art mask/clip requires explicit measurement: '+holder.dataset.asset);if(node!==item&&s.transform!=='none')throw Error('Unsupported ancestor art transform '+holder.dataset.asset);if(node.classList.contains('game-card-layer')&&s.zIndex!=='auto')throw Error('Current layer z-index changed; painter order must be measured explicitly');}
   if(item){const s=getComputedStyle(item);x=parseFloat(s.left)*sx;y=parseFloat(s.top)*sy;w=parseFloat(s.width)*sx;h=parseFloat(s.height)*sy;const t=new DOMMatrix(s.transform);matrix=[t.a,t.b,t.c,t.d,t.e*sx,t.f*sy];origin=s.transformOrigin.split(' ').slice(0,2).map((v,i)=>parseFloat(v)*(i?sy:sx));ctx.translate(x+origin[0],y+origin[1]);ctx.transform(...matrix);ctx.translate(-origin[0],-origin[1]);x=0;y=0;}
   else{const r=img.getBoundingClientRect();x=(r.x-box.x)*sx;y=(r.y-box.y)*sy;w=r.width*sx;h=r.height*sy;}
   if(icss.objectPosition!=='50% 50%')throw Error('Unsupported object-position '+icss.objectPosition);
   const ratio=icss.objectFit==='cover'?Math.max(w/img.naturalWidth,h/img.naturalHeight):Math.min(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*ratio,dh=img.naturalHeight*ratio,dx=x+(w-dw)/2,dy=y+(h-dh)/2;
   if(visible&&opacity>0){ctx.globalAlpha=opacity;ctx.drawImage(img,dx,dy,dw,dh);}
   const pixels=ctx.getImageData(0,0,width,height).data,alpha=new Uint8Array(width*height);for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3];
   const shape={assetId:holder.dataset.asset,itemKey:item?.dataset.item||null,anchor:item?.dataset.anchor||null,layer:layer.dataset.layer,currentSrc:img.currentSrc,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,status:holder.dataset.status,css:icss,holderCSS:css(holder),layerCSS:css(layer),itemCSS:item?css(item):null,cardBox:{width:box.width,height:box.height},imageBox:img.getBoundingClientRect().toJSON(),itemBox:item?.getBoundingClientRect().toJSON()||null,draw:{x,y,width:w,height:h,matrix,origin,drawX:dx,drawY:dy,drawWidth:dw,drawHeight:dh,opacity,visible},sourceCrop:{x:Math.max(0,(x-dx)/ratio)/img.naturalWidth,y:Math.max(0,(y-dy)/ratio)/img.naturalHeight,width:Math.min(w,dw)/ratio/img.naturalWidth,height:Math.min(h,dh)/ratio/img.naturalHeight}};
   geometry.push(shape);images.push({assetId:shape.assetId,currentSrc:img.currentSrc,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight});planes.push({itemKey:shape.itemKey,alpha});
  }
  // Current text caption has a real opaque rounded background and is above equipment.
  const caption=element.querySelector('[data-layer="text"]'),captionStyle=getComputedStyle(caption),captionBox=caption.getBoundingClientRect(),textCanvas=canvas(),textCtx=textCanvas.getContext('2d',{willReadFrequently:true});
  textCtx.fillStyle=captionStyle.backgroundColor;textCtx.globalAlpha=Number(captionStyle.opacity);textCtx.beginPath();textCtx.roundRect((captionBox.x-box.x)*sx,(captionBox.y-box.y)*sy,captionBox.width*sx,captionBox.height*sy,parseFloat(captionStyle.borderRadius)*sx||0);textCtx.fill();
  const glyphBoxes=[];
  for(const node of caption.querySelectorAll('.game-card-name,.game-card-detail')){const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden')continue;const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects()){glyphBoxes.push({text:node.textContent,fontSize:style.fontSize,box:r.toJSON()});textCtx.fillStyle=style.color;textCtx.fillRect((r.x-box.x)*sx,(r.y-box.y)*sy,r.width*sx,r.height*sy);}}
  const textPixels=textCtx.getImageData(0,0,width,height).data,textAlpha=new Uint8Array(width*height);for(let i=0;i<textAlpha.length;i++)textAlpha[i]=textPixels[i*4+3];planes.push({itemKey:null,alpha:textAlpha});
  const regions=Object.entries(face.safeRects).map(([name,r])=>({name,rect:r,area:0,overlap:0})),union=new Uint8Array(width*height),items=[];
  for(let index=0;index<planes.length;index++){
   const p=planes[index];if(!p.itemKey)continue;let transformedAlphaPixels=0,visibleAfterOcclusionPixels=0,visibleAlphaMass=0;const intersections=regions.map(r=>({name:r.name,area:0,overlap:0}));
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x,a=p.alpha[i];if(a){transformedAlphaPixels++;union[i]=1;let contribution=a/255;for(let above=index+1;above<planes.length&&contribution>0;above++)contribution*=1-planes[above].alpha[i]/255;visibleAlphaMass+=contribution;if(contribution>=1/255)visibleAfterOcclusionPixels++;}for(let r=0;r<regions.length;r++){const q=regions[r].rect;if(x>=q.x*width&&x<(q.x+q.width)*width&&y>=q.y*height&&y<(q.y+q.height)*height){intersections[r].area++;if(a)intersections[r].overlap++;}}}
   items.push({itemKey:p.itemKey,transformedAlphaPixels,visibleAfterOcclusionPixels,visibleAlphaMass,protectedRegions:intersections.map(r=>({...r,ratio:r.overlap/r.area}))});
  }
  const captionRegions=regions.map(r=>({...r,area:0,overlap:0}));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(const r of captionRegions){const q=r.rect;if(x>=q.x*width&&x<(q.x+q.width)*width&&y>=q.y*height&&y<(q.y+q.height)*height){r.area++;if(textAlpha[y*width+x])r.overlap++;}}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(const r of regions){const q=r.rect;if(x>=q.x*width&&x<(q.x+q.width)*width&&y>=q.y*height&&y<(q.y+q.height)*height){r.area++;if(union[y*width+x])r.overlap++;}}
  const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
  return {cardId:element.dataset.cardId,side:element.dataset.side,variant:element.dataset.variant,connected:element.isConnected,measuredPixels:{width,height,deviceScaleFactor:devicePixelRatio},cardCSS:css(element),layers:[...element.children].map(n=>n.dataset.layer),geometry,images,items,protectedRegions:regions.map(r=>({...r,ratio:r.overlap/r.area})),transformedItemUnionAlphaSha256:await digest(union),foil:{special:element.querySelector('[data-layer="foil"]').dataset.special,css:css(element.querySelector('[data-layer="foil"]'))},text:{css:css(caption),box:captionBox.toJSON(),glyphBoxes,protectedRegions:captionRegions.map(r=>({...r,ratio:r.overlap/r.area}))},sampling:{layoutWidth:box.width,outputWidth:width,uniformScale:sx,reflow:false},measurement:'Alpha is rasterized at current UI dimensions or a uniform72px reduction of that unchanged layout; never forced72px typography reflow. Native alpha from current DOM images, computed transforms/object fit, ordered alpha transmittance through character/equipment/frame/opaque caption and card crop. Mask/clip changes fail explicitly; semantic recognizability requires direct visual review.'};
 },{face,outputWidth});
}
function assertMeasured(observed){
 expect(observed.connected).toBe(true);expect(observed.layers).toEqual(expectedLayers);expect(observed.cardCSS.transform).toBe('none');expect(Number(observed.foil.css.opacity)).toBe(0);
 for(const r of observed.text.protectedRegions)expect(r.ratio,r.name+' opaque caption or visible text bounds').toBeLessThanOrEqual(.01);
 for(const r of observed.protectedRegions)expect(r.ratio,r.name+' transformed equipment alpha').toBeLessThanOrEqual(.01);
 for(const item of observed.items){expect(item.transformedAlphaPixels).toBeGreaterThan(0);expect(item.visibleAfterOcclusionPixels,item.itemKey+' final visible pixels').toBeGreaterThan(0);for(const r of item.protectedRegions)expect(r.ratio,item.itemKey+':'+r.name).toBeLessThanOrEqual(.01);}
}
async function renderCurrent(page,face,itemKeys){
 await page.evaluate(({face,itemKeys})=>{S.items=Object.fromEntries(itemKeys.map(k=>[k,face.cardId]));GAME_COLLECTION.select(face.cardId);GAME_COLLECTION.refresh();},{face,itemKeys});
 const side=face.side==='alt'?'1':'0';if(await page.locator('#galleryHeat').isVisible())await page.locator('[data-gallery-side="'+side+'"]').click();
 const card=page.locator('#galleryArt .game-card');await expect(card).toHaveAttribute('data-card-id',face.cardId);await expect(card).toHaveAttribute('data-side',face.side);await expect(card.locator('[data-status="loading"]')).toHaveCount(0);await expect(card.locator('[data-status="error"]')).toHaveCount(0);expect(await card.locator('[data-item]').evaluateAll(nodes=>nodes.map(n=>n.dataset.item))).toEqual(itemKeys);return card;
}
async function receiptBindings(face,rows){
 const ids=[face.character,face.background,face.frame,'stage:plinth',...rows.map(r=>'item:'+r.itemKey)],bindings=[];
 for(const id of [...new Set(ids)]){const asset=assetById.get(id),receipt=JSON.parse(await source(asset.reviewReceipt));expect(receipt.binding).toEqual(binding(asset));expect(sha(await source(asset.path))).toBe(asset.sha256);expect(sha(await source(asset.masterPath))).toBe(asset.masterSha256);expect(sha(await source(asset.reference))).toBe(receipt.referenceSha256);bindings.push({assetId:id,sourceSha256:asset.sha256,masterPath:asset.masterPath,masterSha256:asset.masterSha256,referencePath:asset.reference,referenceSha256:receipt.referenceSha256,receiptPath:asset.reviewReceipt,receiptSha256:sha(await source(asset.reviewReceipt)),faceSha256:id===face.character?fingerprint(face):null,crop:manifest.crops.find(c=>c.assetId===id)||null,proofs:receipt.checks});}
 const placements=[];for(const row of rows){const receipt=JSON.parse(await source(row.reviewReceipt));expect(receipt.placementSha256).toBe(fingerprint(row));expect(receipt.characterSha256).toBe(assetById.get(face.character).sha256);expect(receipt.itemSha256).toBe(assetById.get('item:'+row.itemKey).sha256);for(const p of [receipt.fullCard,receipt.at72])expect(sha(await source(p.path))).toBe(p.sha256);placements.push({placement:row,placementSha256:fingerprint(row),mask:row.occlusionMask,receiptPath:row.reviewReceipt,receiptSha256:sha(await source(row.reviewReceipt)),proofs:[receipt.fullCard,receipt.at72]});}
 return {face,faceSha256:fingerprint(face),bindings,placements};
}
for(let start=0;start<manifest.faces.length;start+=8)test(`current UI faces ${start+1}–${Math.min(start+8,47)} full sets and every single placement`,async({page},info)=>{
 const boot=await open(page);await destination(page,'dex');await page.locator('#dexModeGallery').click();const before=await page.evaluate(()=>({state:JSON.stringify(S),saved:localStorage.getItem(KEY)})),rows=[],http=new Map();
 for(const face of manifest.faces.slice(start,start+8)){
  const placements=manifest.placements.filter(p=>p.cardId===face.cardId&&p.side===face.side),sets=[{name:'fullset',items:placements.map(p=>p.itemKey)},...placements.map(p=>({name:p.itemKey,items:[p.itemKey]}))],binding=await receiptBindings(face,placements);
  for(const set of sets){
   const card=await renderCurrent(page,face,set.items),observed=await measureCard(card,face);assertMeasured(observed);for(const [layer,id] of Object.entries({character:face.character,background:face.background,frame:face.frame,plinth:'stage:plinth'}))expect(observed.geometry.find(g=>g.layer===layer)?.assetId).toBe(id);expect(observed.foil.special).toBe(String(face.frame==='frame:special'));
   for(const geometry of observed.geometry){const asset=assetById.get(geometry.assetId);if(!http.has(asset.assetId))http.set(asset.assetId,await servedAsset(page,asset));expect(geometry.currentSrc).toBe(http.get(asset.assetId).url);expect([geometry.naturalWidth,geometry.naturalHeight]).toEqual([asset.dimensions.width,asset.dimensions.height]);if(geometry.itemKey){const placement=placements.find(p=>p.itemKey===geometry.itemKey);expect(geometry.layer).toBe(placement.z===10?'rear-equipment':'front-equipment');expect(geometry.anchor).toBe(placement.anchor);expect(placement.occlusionMask).toBe(null);expect(geometry.itemCSS.maskImage).toBe('none');expect(parseFloat(geometry.itemCSS.transformOrigin)).toBeGreaterThanOrEqual(0);const actual=await card.locator('[data-item="'+geometry.itemKey+'"]').evaluate(n=>{const s=getComputedStyle(n),parent=n.parentElement.getBoundingClientRect(),m=new DOMMatrix(s.transform);return {x:parseFloat(s.left)/parent.width,y:parseFloat(s.top)/parent.height,width:parseFloat(s.width)/parent.width,height:parseFloat(s.height)/parent.height,rotation:Math.atan2(m.b,m.a)*180/Math.PI,pivot:s.transformOrigin.split(' ').slice(0,2).map((v,i)=>parseFloat(v)/parseFloat(i?s.height:s.width))};});for(const k of ['x','y','width','height'])expect(actual[k]).toBeCloseTo(placement.rect[k],3);expect(actual.rotation).toBeCloseTo(placement.rotation,3);expect(actual.pivot[0]).toBeCloseTo(placement.pivot.x,3);expect(actual.pivot[1]).toBeCloseTo(placement.pivot.y,3);}}
   const prefix=slug(key(face))+'-'+set.name,full=await artifact(info,prefix+'-current.png',await card.screenshot({animations:'disabled'}));
   const small=await measureCard(card,face,72);assertMeasured(small);expect(small.measuredPixels.width).toBe(72);expect(small.sampling.layoutWidth).toBe(observed.sampling.layoutWidth);
   const png=await page.evaluate(async base64=>{const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();const c=document.createElement('canvas');c.width=72;c.height=108;c.getContext('2d').drawImage(img,0,0,72,108);return c.toDataURL('image/png').split(',')[1];},(await fs.readFile(full.path)).toString('base64')),at72=await artifact(info,prefix+'-uniform-72.png',Buffer.from(png,'base64'));
   rows.push({cardId:face.cardId,side:face.side,set:set.name,itemKeys:set.items,current:observed,at72:small,proofs:{full,at72},receiptBinding:binding,sourceBinding:[...new Set(observed.images.map(i=>i.assetId))].map(id=>http.get(id)),manualVisualApproval:false});
  }
 }
 await page.evaluate(state=>{S=JSON.parse(state);GAME_COLLECTION.refresh();},before.state);expect(await page.evaluate(()=>({state:JSON.stringify(S),saved:localStorage.getItem(KEY)}))).toEqual(before);
 await capture(info,'current-ui',{manifestSha256:sha(manifestBytes),boot,fixture:'Owned qp-owned fixture; only S.items is arranged for each explicitly labelled combination and restored. No earned-result claim.',denominators:{materialIds:45,fullSetFaces:47,singlePairs:103,singleFacePlacements:107},fullSetNumerator:rows.filter(r=>r.set==='fullset').length,singlePlacementNumerator:rows.filter(r=>r.set!=='fullset').length,rows});
});
test('all 125 base assets and 185 exports bind approved receipts and current immutable URLs',async({page},info)=>{
 const boot=await open(page),rows=[];expect(assets).toHaveLength(185);expect(manifest.assets.filter(a=>!['thumbnail','icon'].includes(a.kind))).toHaveLength(125);
 for(const row of assets){const receipt=JSON.parse(await source(row.reviewReceipt));expect(row.status).toBe('approved');expect(receipt.status).toBe('approved');expect(receipt.binding).toEqual(binding(row));expect(sha(await source(row.masterPath))).toBe(row.masterSha256);expect(sha(await source(row.reference))).toBe(receipt.referenceSha256);expect(sha(await source(receipt.generation.sourceEvidence))).toBe(receipt.generation.sourceEvidenceSha256);const proofs=[];for(const [check,p] of Object.entries(receipt.checks)){if(p.result==='not-applicable')continue;expect(p.result).toBe('pass');expect(sha(await source(p.evidence))).toBe(p.sha256);proofs.push({check,...p});}const face=manifest.faces.find(f=>f.character===row.assetId),crop=manifest.crops.find(c=>c.assetId===row.assetId);expect(receipt.metadata).toEqual({face:face?fingerprint(face):null,crop:crop?fingerprint(crop):null});rows.push({...await servedAsset(page,row),kind:row.kind,masterPath:row.masterPath,masterSha256:row.masterSha256,receiptPath:row.reviewReceipt,receiptSha256:sha(await source(row.reviewReceipt)),proofs,metadata:receipt.metadata});}
 const catalog=JSON.parse(await source('tests/fixtures/catalog.json')),actual=await page.evaluate(()=>({pool:POOL,rates:LVRATE,rare:RARE,pairs:allChars().flatMap(c=>ITEMS.filter(i=>i.fit(c)).map(i=>({cardId:c.id,itemKey:i.key}))),cards:allChars().map(c=>({...c,fam:c.fam.key,spec:specOf(c),back:specOf(c,true),duct:ductRow(specOf(c))}))}));
 expect(actual.pool).toEqual(catalog.pool);expect(actual.rates).toEqual(catalog.rates);expect(actual.rare).toEqual(catalog.rare);expect(actual.cards).toEqual(catalog.cards);expect(actual.pairs).toEqual(manifest.compatiblePairs);expect(actual.pairs).toHaveLength(103);expect(actual.pairs).toContainEqual({cardId:'qp-1470',itemKey:'arrow'});
 expect(new Set(manifest.faces.map(f=>f.cardId)).size).toBe(45);expect(manifest.faces).toHaveLength(47);expect(manifest.placements).toHaveLength(107);expect(manifest.faces.filter(f=>!manifest.placements.some(p=>key(p)===key(f))).map(f=>f.cardId).sort()).toEqual(['wr-NHT','wr-SWRM','wr-SWRY']);expect(manifest.placements.filter(p=>p.side==='alt').map(p=>key(p)+':'+p.itemKey).sort()).toEqual(['ga-1470H:alt:arrow','ga-1470H:alt:iron','ga-1470H:alt:spark','poo-PHS:alt:arrow']);
 await capture(info,'all-source-runtime-receipts',{manifestSha256:sha(manifestBytes),boot,baseNumerator:125,baseDenominator:125,exportNumerator:rows.length,exportDenominator:185,rows,catalog:actual,manualVisualApproval:false});
});
const otherAssets=assets.filter(a=>!candidateIds.includes(a.assetId)&&!controls.includes(a.assetId));
for(let start=0;start<otherAssets.length;start+=20)test(`remaining runtime exports ${start+1}–${Math.min(start+20,otherAssets.length)} decode without being new candidates`,async({page,browser},info)=>{
 await open(page);const rows=[];for(const row of otherAssets.slice(start,start+20)){const http=await servedAsset(page,row),observed=await native(page,row);delete observed.rgbaBase64;expect([observed.width,observed.height]).toEqual([row.dimensions.width,row.dimensions.height]);const proofs=[];for(const {png,...p} of observed.proofs)proofs.push({...p,...await artifact(info,slug(row.assetId)+'-'+p.name+'.png',Buffer.from(png.split(',')[1],'base64'))});delete observed.proofs;for(const bg of observed.composites)expect(bg.alpha0BackgroundMismatchPixels).toBe(0);rows.push({...http,...observed,proofs,engine:info.project.name,browserVersion:browser.version()});}await capture(info,'remaining-native-exports',{remainingDenominator:otherAssets.length,rows,notCandidateCoverage:true,manualVisualApproval:false});
});
test('current product grid parts cars environments thumbnails and installation icons retain category coverage',async({page},info)=>{
 const boot=await open(page),rows=[];await destination(page,'dex');await page.locator('#dexModeGrid').click();const thumbs=await page.locator('#dex [data-card-id] img').evaluateAll(async nodes=>{for(const i of nodes)i.loading='eager';await Promise.all(nodes.map(i=>i.decode()));return nodes.map(i=>({cardId:i.closest('[data-card-id]').dataset.cardId,url:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight,box:i.getBoundingClientRect().toJSON()}));});expect(thumbs).toHaveLength(45);for(const image of thumbs){const row=assetById.get('thumbnail:'+image.cardId+':front');expect([image.width,image.height]).toEqual([144,216]);expect(image.box.width).toBe(72);expect(image.box.height).toBe(108);expect(image.url).toBe((await servedAsset(page,row)).url);}await artifact(info,'actual-grid.png',await page.locator('#view-dex').screenshot({animations:'disabled'}));
 await destination(page,'craft');const parts=await page.locator('#parts [data-part-key] img').evaluateAll(async nodes=>{for(const i of nodes)i.loading='eager';await Promise.all(nodes.map(i=>i.decode()));return nodes.map(i=>({key:i.closest('[data-part-key]').dataset.partKey,url:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight}));});expect(parts).toHaveLength(35);for(const image of parts)expect(image.url).toBe((await servedAsset(page,assetById.get('part:'+image.key))).url);await artifact(info,'actual-35-parts.png',await page.locator('#view-craft').screenshot({animations:'disabled'}));
 await destination(page,'garage');const carKeys=await page.locator('#garage [data-car-key]').evaluateAll(nodes=>nodes.map(n=>n.dataset.carKey));expect(carKeys).toHaveLength(8);for(const car of carKeys){await page.locator('#garage [data-car-key="'+car+'"]').click();await expect(page.locator('#garageDetailArt [data-status="loading"]')).toHaveCount(0);await expect(page.locator('#garageDetailArt [data-status="error"]')).toHaveCount(0);const image=await page.locator('#garageDetailArt img').evaluate(i=>({url:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight}));expect(image.url).toBe((await servedAsset(page,assetById.get('car:'+car))).url);expect([image.width,image.height]).toEqual([1200,800]);rows.push({car,...image,proof:await artifact(info,'actual-car-'+car+'.png',await page.locator('#garageDetailArt').screenshot({animations:'disabled'}))});await page.keyboard.press('Escape');}
 const environments=[];for(const route of ['workshop','dex','craft','research','garage']){await destination(page,route);const found=await page.locator('#view-'+route).evaluate(element=>{const urls=[];for(const n of [element,...element.querySelectorAll('*')]){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden')continue;if(n instanceof HTMLImageElement&&n.currentSrc)urls.push({url:n.currentSrc,type:'img',box:n.getBoundingClientRect().toJSON()});if(s.backgroundImage!=='none')urls.push({url:s.backgroundImage,type:'background',box:n.getBoundingClientRect().toJSON(),size:s.backgroundSize,position:s.backgroundPosition});}return urls;});environments.push({route,found,proof:await artifact(info,'actual-route-'+route+'.png',await page.screenshot({animations:'disabled'}))});}
 const webmanifest=await (await page.request.get(new URL('manifest.webmanifest',appURL).href)).json(),icons=[];for(const icon of webmanifest.icons){const response=await page.request.get(new URL(icon.src,appURL).href),body=await response.body(),row=assets.find(a=>a.kind==='icon'&&a.sha256===sha(body));expect(row).toBeDefined();icons.push({assetId:row.assetId,url:response.url(),sha256:sha(body),declared:icon});}const apple=await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'),appleResponse=await page.request.get(new URL(apple,appURL).href);expect(sha(await appleResponse.body())).toBe(assetById.get('icon:180').sha256);
 await capture(info,'category-current-ui',{boot,thumbs,parts,cars:rows,environments,icons,apple:{url:appleResponse.url(),sha256:sha(await appleResponse.body())},denominators:{gridFrontThumbnails:45,altThumbnailExports:2,nativeThumbnails:47,parts:35,cars:8,baseEnvironmentArt:21,icons:3},note:'Grid uses 45 front thumbnails. Two alt thumbnail exports and environment/draw exports also have separate full native proofs; route DOM observations are listed explicitly, without treating absent DOM IDs as visible.',manualVisualApproval:false});
});
async function schemaNegative(info,name,mutate){
 const fixture=path.join(process.env.TMPDIR,'art-full-'+info.project.name+'-'+name),report=info.outputPath(name+'-cli.json');await artifact(info,name+'-resources.json',Buffer.from(JSON.stringify({status:'registered-before-creation',fixture,ports:[],childTimeoutMs:15000})));
 try{await fs.mkdir(path.join(fixture,'docs/design'),{recursive:true});const changed=structuredClone(manifest);mutate(changed);await fs.writeFile(path.join(fixture,manifestPath),JSON.stringify(changed));const before=sha(await fs.readFile(path.join(fixture,manifestPath))),args=[path.join(root,'tools/verify-game-assets.mjs'),'--root',fixture,'--schema-only','--report',report],child=spawnSync(process.execPath,args,{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});expect(child.error).toBeUndefined();expect(child.status).toBe(1);const output=JSON.parse(await fs.readFile(report));expect(output.status).toBe('FAIL');expect(sha(await fs.readFile(path.join(fixture,manifestPath)))).toBe(before);await capture(info,name+'-actual-cli',{command:[process.execPath,...args],exit:child.status,stdout:child.stdout,stderr:child.stderr,output,fixtureManifestUnchanged:true});return output;}
 finally{await fs.rm(fixture,{recursive:true,force:true});await artifact(info,name+'-cleanup.json',Buffer.from(JSON.stringify({fixture,existsAfter:await fs.access(fixture).then(()=>true,()=>false)})));}
}
function assertSourceSHA(actual,expected){expect(actual,'actual source byte binding').toBe(expected);}
test('five real negative classes reject swapped alt missing thumbnail occlusion stale geometry and undefined asset',async({page},info)=>{
 await open(page);const productionBefore=sha(await fs.readFile(path.join(root,manifestPath)));expect(()=>decodeRaster(Buffer.from('not a raster'))).toThrow(/mime/);
 const swapped=await schemaNegative(info,'swapped-alt',m=>{const f=m.faces.find(f=>f.side==='alt');f.character='character:'+f.cardId+':front';});expect(swapped.code).toBe('contract');
 const face=manifest.faces.find(f=>f.side==='alt'),alt=assetById.get(face.character),front=assetById.get('character:'+face.cardId+':front'),url=await page.evaluate(id=>GAME_CONFIG.assets[id].url,alt.assetId);await page.route('**/'+url,r=>r.fulfill({contentType:'image/webp',body:fileCache.get(front.path)}));await source(front.path);const swappedHTTP=await page.evaluate(async url=>{const r=await fetch(url,{cache:'reload'}),b=await r.arrayBuffer();return {url:r.url,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(n=>n.toString(16).padStart(2,'0')).join('')};},url);expect(()=>assertSourceSHA(swappedHTTP.sha256,alt.sha256)).toThrow();await page.unroute('**/'+url);await capture(info,'swapped-alt-byte-guard',{expected:alt.sha256,actual:swappedHTTP,rejected:true});
 const missing=await schemaNegative(info,'missing-thumbnail-row',m=>{m.assets.splice(m.assets.findIndex(a=>a.kind==='thumbnail'),1);});expect(missing.code).toBe('asset-count');
 const fixture=path.join(process.env.TMPDIR,'art-full-guards-'+info.project.name);await artifact(info,'guards-resources.json',Buffer.from(JSON.stringify({status:'registered-before-creation',fixture,ports:[]})));await fs.mkdir(path.join(fixture,'docs/design/game-reviews/placements'),{recursive:true});
 try{
  const thumbnail=assets.find(a=>a.kind==='thumbnail');await expect(inspectAsset(thumbnail,fixture)).rejects.toMatchObject({code:'ENOENT'});await capture(info,'missing-thumbnail-file',{assetId:thumbnail.assetId,guard:'inspectAsset/fileBytes',code:'ENOENT',fixture});
  await destination(page,'dex');await page.locator('#dexModeGallery').click();const protectedFace=manifest.faces.find(f=>f.cardId==='ssial-270E'&&f.side==='front'),row=manifest.placements.find(p=>key(p)===key(protectedFace)&&p.itemKey==='shield'),card=await renderCurrent(page,protectedFace,['shield']),safe=await measureCard(card,protectedFace);assertMeasured(safe);
  await card.locator('[data-item="shield"]').evaluate(n=>{Object.assign(n.style,{left:'22%',top:'24%',width:'60%',height:'40%',transform:'rotate(0deg)',transformOrigin:'50% 50%'});});const obstructed=await measureCard(card,protectedFace);expect(()=>assertMeasured(obstructed)).toThrow();const ratio=Math.max(...obstructed.protectedRegions.map(r=>r.ratio));expect(ratio).toBeGreaterThan(.01);
  const moved={...row,rect:{x:.22,y:.24,width:.6,height:.4},rotation:0,pivot:{x:.5,y:.5}},receipt=JSON.parse(await source(row.reviewReceipt));Object.assign(receipt,{placementSha256:fingerprint(moved),protectedIntersectionRatio:ratio});await fs.writeFile(path.join(fixture,row.reviewReceipt),JSON.stringify(receipt));await expect(reviewPlacement(moved,{root:fixture,reviewRoot:'docs/design/game-reviews',manifest})).rejects.toMatchObject({code:'placement-visibility'});await capture(info,'native-protected-face-occlusion',{safe,obstructed,measuredRatio:ratio,guard:'placement-visibility',proof:await artifact(info,'actual-occluded-face.png',await card.screenshot({animations:'disabled'}))});
  await fs.writeFile(path.join(fixture,row.reviewReceipt),await source(row.reviewReceipt));await expect(reviewPlacement({...row,rotation:row.rotation+1},{root:fixture,reviewRoot:'docs/design/game-reviews',manifest})).rejects.toMatchObject({code:'placement-binding'});await capture(info,'stale-geometry-receipt',{originalPlacementSha256:fingerprint(row),stalePlacementSha256:fingerprint({...row,rotation:row.rotation+1}),guard:'placement-binding'});
 }finally{await fs.rm(fixture,{recursive:true,force:true});await artifact(info,'guards-cleanup.json',Buffer.from(JSON.stringify({fixture,existsAfter:await fs.access(fixture).then(()=>true,()=>false)})));}
 const undefinedAsset=await schemaNegative(info,'undefined-asset',m=>{m.assets[0].assetId='item:undefined-art';});expect(undefinedAsset.code).toBe('unknown-asset');
 const qpFace=manifest.faces.find(f=>f.cardId==='qp-1470'),qpCard=await renderCurrent(page,qpFace,[]);await page.evaluate(()=>{const original=GAME_PRESENTATION;window.artUndefinedOriginal=original;window.artUndefinedAsset=GAME_CONFIG.assets['character:qp-1470:front'];GAME_PRESENTATION={...original,render(input){const view=original.render(input);window.artNegativeReady=view.ready;return view;}};delete GAME_CONFIG.assets['character:qp-1470:front'];GAME_COLLECTION.refresh();});const ready=await page.evaluate(()=>artNegativeReady);expect(ready.includes(false)).toBe(true);await expect(qpCard.locator('[data-asset="character:qp-1470:front"]')).toHaveAttribute('data-status','error');await expect(qpCard.getByRole('button',{name:/그림 다시 시도/})).toBeVisible();await qpCard.getByRole('button',{name:/그림 다시 시도/}).click();await expect(qpCard.locator('[data-status="error"]')).toHaveCount(1);await capture(info,'undefined-current-ui-fallback',{ready,guard:'ready=false and readable error/retry; no expected throw',proof:await artifact(info,'actual-undefined-retry.png',await qpCard.screenshot({animations:'disabled'}))});await page.evaluate(()=>{GAME_CONFIG.assets['character:qp-1470:front']=artUndefinedAsset;GAME_PRESENTATION=artUndefinedOriginal;GAME_COLLECTION.refresh();});await expect(qpCard.locator('[data-status="loading"]')).toHaveCount(0);await expect(qpCard.locator('[data-status="error"]')).toHaveCount(0);
 expect(sha(await fs.readFile(path.join(root,manifestPath)))).toBe(productionBefore);await capture(info,'five-negative-summary',{classes:['swapped-alt','missing-thumbnail','native-face-occlusion','stale-geometry-receipt','undefined-asset'],count:5,productionManifestUnchanged:true,allFixturesOwned:true});
});

test('real tenPull compact cards keep names LV and protected faces at four viewports',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await openApp(page,appURL,'mid-progress');
 const mute=page.getByRole('button',{name:'무음으로 계속',exact:true});if(await mute.isVisible())await mute.click();await destination(page,'workshop');
 const rng=await page.evaluate(()=>{const original=Math.random,found={};const buckets=bucketize(POOL),levels=[1,2,3,4].filter(k=>buckets[k].length),total=levels.reduce((s,k)=>s+LVRATE[k],0);for(const id of ['ga-1180Y','ga-1470H']){const lv=lvOf(findChar(id)),a=(levels.filter(k=>k<lv).reduce((s,k)=>s+LVRATE[k],0)+LVRATE[lv]/2)/total,list=buckets[lv],weights=list.map(rareOf);if(pickFam()){let sp=0,so=0;list.forEach((id,i)=>{if(isPick(id))sp+=weights[i];else so+=weights[i];});if(sp>0&&so>0){const share=sp/(sp+so),boost=Math.min(.95,share*pickX());list.forEach((id,i)=>weights[i]*=isPick(id)?boost/share:(1-boost)/(1-share));}}const index=list.indexOf(id),b=(weights.slice(0,index).reduce((s,w)=>s+w,0)+weights[index]/2)/weights.reduce((s,w)=>s+w,0);let n=0;Math.random=()=>n++===0?a:b;const observed=weightedPick();Math.random=original;if(observed!==id)throw Error('RNG verification mismatch '+observed);found[id]=[a,b];}window.captionOriginalRandom=original;const sequence=Array.from({length:10},(_,i)=>found[i%2?'ga-1470H':'ga-1180Y']).flat();let index=0;Math.random=()=>sequence[index++]??original();return{found,sequence,scrapBefore:S.scrap,ownedBefore:Object.keys(S.owned)};});
 await page.locator('#btnTen').click();const skip=page.locator('[data-draw-skip]');if(await skip.isVisible())await skip.click();
 await expect(page.locator('#pullBox .game-card')).toHaveCount(10);await expect(page.locator('#pullBox [data-status="loading"]')).toHaveCount(0);await expect(page.locator('#pullBox [data-status="error"]')).toHaveCount(0);
 await page.evaluate(()=>{Math.random=window.captionOriginalRandom;});const rows=[];
 for(const viewport of [{width:360,height:800},{width:390,height:844},{width:768,height:900},{width:1280,height:900}]){
  await page.setViewportSize(viewport);
  for(const cardId of ['ga-1180Y','ga-1470H']){const card=page.locator('#pullBox .game-card[data-card-id="'+cardId+'"]').first(),face=manifest.faces.find(f=>f.cardId===cardId&&f.side==='front');const observed=await measureCard(card,face);assertMeasured(observed);await expect(card.locator('.game-card-name')).toBeVisible();await expect(card.locator('xpath=..').locator('xpath=..').locator('.draw-meta')).toContainText('LV');rows.push({viewport,cardId,observed,proof:await artifact(info,cardId+'-'+viewport.width+'-tenPull.png',await card.screenshot({animations:'disabled'}))});}
 }
 await page.setViewportSize({width:390,height:844});const card=page.locator('#pullBox .game-card[data-card-id="ga-1180Y"]').first(),face=manifest.faces.find(f=>f.cardId==='ga-1180Y');
 await card.locator('.game-card-text').evaluate(n=>{Object.assign(n.style,{inset:'4% 8% auto',padding:'8px',lineHeight:'1.5',gap:'4px'});n.querySelector('.game-card-detail').style.display='block';});
 const regressed=await measureCard(card,face);expect(()=>assertMeasured(regressed)).toThrow();expect(regressed.text.protectedRegions.find(r=>r.name==='face').ratio).toBeGreaterThan(.01);
 const negative=await artifact(info,'caption-regression-rejected.png',await card.screenshot({animations:'disabled'}));await card.locator('.game-card-text').evaluate(n=>{n.removeAttribute('style');n.querySelector('.game-card-detail').removeAttribute('style');});assertMeasured(await measureCard(card,face));
 await capture(info,'real-tenPull-caption',{rng,rows,negative:{regressed,proof:negative,rejected:true},manualVisualApproval:false});
});
test('all47 derived thumbnail exports retain exact72px display including both alt sides',async({page},info)=>{
 await open(page);const thumbs=assets.filter(a=>a.kind==='thumbnail');expect(thumbs).toHaveLength(47);const rows=[];
 for(const row of thumbs){const http=await servedAsset(page,row);rows.push({...http,cardId:row.assetId.split(':')[1],side:row.assetId.split(':')[2]});}
 await page.setViewportSize({width:1280,height:1200});
 await page.evaluate(rows=>{const panel=document.createElement('section');panel.id='derived-thumbnail-proof';panel.style.cssText='position:fixed;inset:0 auto auto 0;z-index:2147483647;width:max-content;display:grid;grid-template-columns:repeat(8,100px);gap:12px;background:#242c33;padding:16px;color:white';for(const row of rows){const box=document.createElement('div'),img=new Image();img.src=row.url;img.style.cssText='display:block;width:72px;height:108px';box.append(img,document.createTextNode(row.cardId+' '+row.side));panel.append(box);}document.body.append(panel);},rows);
 const measured=await page.locator('#derived-thumbnail-proof img').evaluateAll(async nodes=>{await Promise.all(nodes.map(n=>n.decode()));return nodes.map(n=>({url:n.currentSrc,natural:[n.naturalWidth,n.naturalHeight],box:n.getBoundingClientRect().toJSON()}));});for(const row of measured){expect(row.natural).toEqual([144,216]);expect(row.box.width).toBe(72);expect(row.box.height).toBe(108);}
 const panelBox=await page.locator('#derived-thumbnail-proof').boundingBox();expect(panelBox.width).toBeLessThanOrEqual(1280);expect(panelBox.height).toBeLessThanOrEqual(1200);for(const row of measured){expect(row.box.x).toBeGreaterThanOrEqual(panelBox.x);expect(row.box.right).toBeLessThanOrEqual(panelBox.x+panelBox.width);expect(row.box.bottom).toBeLessThanOrEqual(panelBox.y+panelBox.height);}
 await capture(info,'derived-thumbnail72',{rows,measured,panelBox,scope:'Supplemental export sheet; actual45-front grid tested separately. Not a product route.',proof:await artifact(info,'all47-derived72.png',await page.locator('#derived-thumbnail-proof').screenshot()),manualVisualApproval:false});
});
