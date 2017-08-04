function prepareSelectedArtboards (context) {
	var selection = context.selection;
	
	// 提取所选画板
	var selectedArtboards = [];
	for (var i = 0; i < selection.length; i++) {
		if (selection[i].isMemberOfClass(MSArtboardGroup)) {
			selectedArtboards.push(selection[i]);
		}
	}

	// 将画板按照画布中的位置排序
	function compareArtboards (firstAB, secondAB) {
		if (firstAB.frame().y() != secondAB.frame().y()) {
			return firstAB.frame().y() - secondAB.frame().y();
		} else {
			return firstAB.frame().x() - secondAB.frame().x();
		}
	}
	selectedArtboards.sort(compareArtboards);
	return selectedArtboards;
}

function updatePageNumbersOfArtboards (artboards) {

    // 结果用于存储目录信息，以及是否更新成功
    var result = {};
    result.isSuccess = false;
    result.data = {};

	// 未选择图层提示
	if (artboards.length == 0) {
		[NSApp displayDialog: "请选择文档的所有画板（包括封面和概述）" withTitle: "页码更新失败"];
		return result;
	} 

	// 获取要修改的图层 ID
	var layerIDs = null
    function getLayerIDs(symbolInstance) {
        var symbolMaster = symbolInstance.symbolMaster();
        var children = symbolMaster.children();
        var layerIDs = {};

        for (var i = 0; i < [children count]; i++){
            var layer = children[i];
            if( layer.name() == "3" )   { layerIDs.currentPage_ID = layer.objectID() }
            if( layer.name() == "10" )    { layerIDs.totalPages_ID = layer.objectID() }
        }
        return layerIDs;
    }
    
    // 从第三个画板开始，找到页码图层并更新内容
    for (var i = 0; i < artboards.length; i++) {
		if (i > 1) {
            var layersInArtboard = artboards[i].children();
            var pageTitleLayer = null;
            var pageNumberLayer = null;

            for (var j = 0; j < layersInArtboard.length; j++) {

            	// 筛选出功能概述
            	if (layersInArtboard[j].name() == "功能概述") {
            		pageTitleLayer = layersInArtboard[j]
                }

                // 筛选出页码
                if (layersInArtboard[j].name() == "交互图例 / 页码") {
                	pageNumberLayer = layersInArtboard[j]
                    if (layerIDs == null ) {
                        layerIDs = getLayerIDs(pageNumberLayer);
                        if (layerIDs == null) {
                            [NSApp displayDialog: "页码图层需为 symbol" withTitle: "页码更新失败"];
		                    return result;
                        }
                    }
                }
            }

            if (pageTitleLayer == null || pageNumberLayer == null) {
                [NSApp displayDialog: "请检查文档是否符合以下条件：\n1. 文档所有画板（包括封面和概述）都被选中，并按从上到下、从左到右的顺序排列\n2. 从第三个画板开始，功能概述的图层名需为“功能概述”，页码的图层名需为“交互图例 / 页码”" withTitle: "页码更新失败"];
                return result;
            }

            // 将数据写入 result
            result.data[i] = pageTitleLayer.stringValue();


            // 设定页码值
            var pageData = {};
            pageData[layerIDs.currentPage_ID.toString()] = (i+1).toString();
            pageData[layerIDs.totalPages_ID.toString()] = artboards.length.toString();
            pageNumberLayer.overrides = pageData;

            //更新标题与页码的间距
            pageTitleLayer.frame().setX(164);
            pageTitleLayer.frame().setY(65);
            pageNumberLayer.frame().setX(pageTitleLayer.frame().x() + pageTitleLayer.frame().width() + 50);
            pageNumberLayer.frame().setY(pageTitleLayer.frame().y() - 2)
		}
	}
    result.isSuccess = true;
	return result;
}

var updatePageNumbers = function (context) {
	var selectedArtboards = prepareSelectedArtboards(context);
	var result = updatePageNumbersOfArtboards(selectedArtboards);
	if (result) { context.document.showMessage("页码更新成功") }
}

var updateCatalog = function (context) {
    var selectedArtboards = prepareSelectedArtboards(context);
    var result = updatePageNumbersOfArtboards(selectedArtboards);
    if (!result.isSuccess) { return }
       
    // 处理重复标题，生成目录数据
    var catalog = {};
    var lastTitle = "";
    for (var page in result.data) {
        if (result.data[page].localeCompare(lastTitle) != 0) {
            catalog[page] = result.data[page];
        }
        lastTitle = result.data[page];
    }

    // 如果目录大于 16，提示暂不支持
    var cataloglength = Object.keys(catalog).length;
    if (cataloglength > 16) {
        [NSApp displayDialog: "暂不支持超过 16 条的目录" withTitle: "页码更新成功，目录更新失败"];
        return;
    }

    // 清理旧目录，以及获取日期图层
    var coverArtboard = selectedArtboards[0];
    var layersInCoverArtboard = coverArtboard.children();
    var dateLayer = null;
    for (var i = 0; i < layersInCoverArtboard.length; i++) {
        if (layersInCoverArtboard[i].name() == "目录一" || 
            layersInCoverArtboard[i].name() == "目录二" ||
            layersInCoverArtboard[i].name() == "目录三" ||
            layersInCoverArtboard[i].name() == "目录四" ) {
            layersInCoverArtboard[i].removeFromParent();
        } else if (layersInCoverArtboard[i].name() == "date") {
            dateLayer = layersInCoverArtboard[i];
        }
    }

    // 生成新目录文字图层
    var catalogTextLayers = [];
    for (var pageNumber in catalog) {
        var textLayer = MSTextLayer.new();
        var catalogString = (parseInt(pageNumber) + 1) + " " + catalog[pageNumber];
        textLayer.setStringValue(catalogString);
        textLayer.setName(catalogString);
        var font = [NSFont fontWithName: "PingFangSC-Medium" size: 40];
        textLayer.setFont(font);
        textLayer.textColor = MSColor.colorWithRGBADictionary({"r": 0.29, "g": 0.29, "b": 0.29, "a": 1});
        textLayer.adjustFrameToFit();
        catalogTextLayers.push(textLayer);
    }

    // 设定目录文字图层的纵向间距
    for (var i = 1; i < catalogTextLayers.length; i++) {
        catalogTextLayers[i].frame().setY(catalogTextLayers[i-1].frame().y() + 117);
    }

    // 用于存放目录图层组
    var catalogTextLayerGroups = [];

    // 根据目录文字图层，以及每一组的图层数量来将目录图层文字分组
    function genetateGroupsFromLayes(layers, groupSize) {
        var layerGroups = [];
        var names = ["目录一", "目录二", "目录三", "目录四"];
        var numberOfGroups = Math.ceil(layers.length / groupSize);
        for (var i = 0; i < numberOfGroups; i++) {
            var layerGroup = MSLayerGroup.new();
            layerGroup.setName(names[i]);
            layerGroup.addLayers(layers.slice(i*groupSize, (i+1)*groupSize));
            layerGroup.resizeToFitChildrenWithOption(0);
            layerGroups.push(layerGroup);
        }
        return layerGroups;
    }

    // 5、6、9 条目录时，每组目录 3 条，其他情况下都是 4 条
    switch (cataloglength) {
        case 5:
        case 6:
        case 9:
        catalogTextLayerGroups = genetateGroupsFromLayes(catalogTextLayers, 3);
        break;

        default:
        catalogTextLayerGroups = genetateGroupsFromLayes(catalogTextLayers, 4);
        break;
    }

    // 设定每个组的位置，并置入封面画板
    catalogTextLayerGroups[0].frame().setX((coverArtboard.frame().width() - catalogTextLayerGroups[catalogTextLayerGroups.length - 1].frame().width() - 691 * (catalogTextLayerGroups.length - 1)) / 2);
    for (var i = 0; i < catalogTextLayerGroups.length; i++) {
        catalogTextLayerGroups[i].frame().setX(catalogTextLayerGroups[0].frame().x() + 691 * i);
        catalogTextLayerGroups[i].frame().setY(1132);
    }
    coverArtboard.addLayers(catalogTextLayerGroups);

    // 更新日期
    if (dateLayer != null) {
        var dateOfNow = new Date();
        dateLayer.setStringValue("最后更新日期 " + dateOfNow.getFullYear() + " 年 " + (dateOfNow.getMonth() + 1) + " 月 " + dateOfNow.getDate() + " 日");
    } else {
        [NSApp displayDialog: "请更新至最新版交互文档模板" withTitle: "页码及目录更新成功，日期更新失败"];
    }

    context.document.showMessage("目录及页码更新成功");
}